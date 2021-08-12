import * as vscode from 'vscode';
import { TestCase, testData, TestFile } from './testTree';
import { generateDriver, cleanup, writeLocalFile } from './driverUtils';

export async function activate(context: vscode.ExtensionContext) {
  
  const disposable = vscode.commands.registerCommand('cpp-unit-test.unit_test_init', () => {
		// The code you place here will be executed every time your command is executed
                
    if (!vscode.workspace.findFiles("./Makefile")) {
      writeLocalFile(`CXX: clang++
                      unit-test: unit_tests.h unit-test-driver.cpp
                      \t$(CXX) unit-test-driver.cpp"`, "Makefile");
    }
    if (!vscode.workspace.findFiles("./unit_tests.h")) {
      writeLocalFile(`#include <cassert>
        #include <iostream>
        
        void test_pass() {
            assert(0 == 0);
        }`,"unit_tests.h");
    }
		
	});

	context.subscriptions.push(disposable);

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

    const runTestQueue = async () => {
        await generateDriver(queue);            
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

/* code coverage stuff.
  //const coveredLines = new Map</* file uri  string, (vscode.StatementCoverage | undefined)[]>();

   
        /*if (test.uri && !coveredLines.has(test.uri.toString())) {
          try {
            const lines = (await getContentFromFilesystem(test.uri)).split('\n');
            coveredLines.set(
              test.uri.toString(),
              lines.map((lineText, lineNo) =>
                lineText.trim().length ? new vscode.StatementCoverage(0, new vscode.Position(lineNo, 0)) : undefined
              )
            );
          } catch {
            // ignored
          }
        }*/