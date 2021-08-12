import * as vscode from 'vscode';
import { TestCase, testData, TestFile } from './testTree';
import { generateDriver, cleanup, execShellCommand, getFileUri, 
         getMakefileTarget, getDriverFilename, getCwdUri, 
         getDriverCleanUpOnBuild } from './driverUtils';
import { exit } from 'process';

export async function activate(context: vscode.ExtensionContext) {  

  const ctrl = vscode.tests.createTestController('TestController', 'Test');
  context.subscriptions.push(ctrl);  

  const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
    const queue: { test: vscode.TestItem; data: TestCase }[] = [];
    const run = ctrl.createTestRun(request);
            
    // map of file uris to statments on each line:
    const discoverTests = async (tests: Iterable<vscode.TestItem>) => {         
      for (const test of tests) {        
        if (request.exclude?.includes(test)) {
          continue;
        }

        const data = testData.get(test);
        if (data instanceof TestCase) {          
          run.enqueued(test);
          queue.push({ test, data });                 
        } else {         
          if (data instanceof TestFile && !data.didResolve) {
            await data.updateFromDisk(ctrl, test);
          }           
          await discoverTests(gatherTestItems(test.children));
        }       
      }
    };    

    const runMake = async function() : Promise<string> {   
        const folderUri = getCwdUri();     
        if (!folderUri) { return "failed"; }        
    
      // let's run make after parsing the test file.  
        let makeResult = await execShellCommand('make ' + getMakefileTarget(), {cwd: folderUri.fsPath});
        
        if (getDriverCleanUpOnBuild()) {
            const fileUri = getFileUri(folderUri, getDriverFilename() );     
            vscode.workspace.fs.delete(fileUri);  
        }
        if (makeResult.passed) {                    
            return "passed";
        }else {
            return makeResult.stderr;
        }          
    };

    const runTestQueue = async () => {
        await generateDriver(queue);   
        const makeResult = await runMake();

        if (makeResult !== "passed") {            
            run.appendOutput(`Compilation Failed\r\n`);
            const data = new TestCase("compilation", 0);
            const id = `${queue[0].test.uri}/${"data.getLabel()"}`;        
    
            const tcase = ctrl.createTestItem(id, data.getLabel(), queue[0].test.uri);
            testData.set(tcase, data);
            run.started(tcase);
            let message = new vscode.TestMessage(makeResult); 
            message.location = new vscode.Location(queue[0].test.uri!, queue[0].test.range!);
            run.failed(queue[0].test, message, 0);
            run.end();
            exit(1);
        }
       
        
        for (const { test, data } of queue) {        
            run.appendOutput(`Running ${test.id}\r\n`);
            console.log(test.id);
            if (cancellation.isCancellationRequested) {          
                run.skipped(test);
            } else {
                run.started(test);
                await data.run(test, run);          
            }
            run.appendOutput(`Completed ${test.id}\r\n`);        
        }
        console.log("about to end run");      
        run.end();
        await cleanup();
    };    
    discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(runTestQueue);
    
  };

  
  ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true);

  ctrl.resolveHandler = async item => {
    if (!item) {
      context.subscriptions.push(...startWatchingWorkspace(ctrl));
      return;
    }

    const data = testData.get(item);
    if (data instanceof TestFile) {
      await data.updateFromDisk(ctrl, item);
    }
  };


  function updateNodeForDocument(e: vscode.TextDocument) {
    if (e.uri.scheme !== 'file') {
      return;
    }
    
    if (!e.uri.path.endsWith('tests.h')) {
      return;
    }

    const { file, data } = getOrCreateFile(ctrl, e.uri);
    data.updateFromContents(ctrl, e.getText(), file);
  }

  for (const document of vscode.workspace.textDocuments) {
    updateNodeForDocument(document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
    vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
  );
}

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
  const existing = controller.items.get(uri.toString());
  if (existing) {
    return { file: existing, data: testData.get(existing) as TestFile };
  }

  const file = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
  controller.items.add(file);

  const data = new TestFile();
  testData.set(file, data);

  file.canResolveChildren = true;
  return { file, data };
}

function gatherTestItems(collection: vscode.TestItemCollection) {
  const items: vscode.TestItem[] = [];
  collection.forEach(item => items.push(item));
  return items;
}

function startWatchingWorkspace(controller: vscode.TestController) {
  if (!vscode.workspace.workspaceFolders) {
    return [];
  }

  return vscode.workspace.workspaceFolders.map(workspaceFolder => {
    const pattern = new vscode.RelativePattern(workspaceFolder, '**/*unit_tests.h');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate(uri => getOrCreateFile(controller, uri));
    watcher.onDidChange(uri => {
      const { file, data } = getOrCreateFile(controller, uri);
      if (data.didResolve) {
        data.updateFromDisk(controller, file);
      }
    });
    watcher.onDidDelete(uri => controller.items.delete(uri.toString()));

    vscode.workspace.findFiles(pattern).then(files => {
      for (const file of files) {
        getOrCreateFile(controller, file);
      }
    });

    return watcher;
  });
}