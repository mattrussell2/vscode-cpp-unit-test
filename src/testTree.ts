import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { parseTestsFile } from './parser';
import { join } from 'path';
import { execShellCommand, getExecutableFilename } from './driverUtils';

const textDecoder = new TextDecoder('utf-8');

export type TestData = TestFile | TestHeading | TestCase;

export const testData = new WeakMap<vscode.TestItem, TestData>();

let generationCounter = 0;

export const getContentFromFilesystem = async (uri: vscode.Uri) => {
  try {
    const rawContent = await vscode.workspace.fs.readFile(uri);
    return textDecoder.decode(rawContent);
  } catch (e) {
    console.warn(`Error providing tests for ${uri.fsPath}`, e);
    return '';
  }
};

export class TestFile {
  public didResolve = false;

  public async updateFromDisk(controller: vscode.TestController,item: vscode.TestItem) {
    try {
      const content = await getContentFromFilesystem(item.uri!);
      item.error = undefined;
      this.updateFromContents(controller, content, item);
    } catch (e) {
      item.error = e.stack;
    }
  }

  /**
   * Parses the tests from the input text, and updates the tests contained
   * by this file to be those from the text,
   */
  public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
    const ancestors = [{ item, children: [] as vscode.TestItem[]}];
    const thisGeneration = generationCounter++;
    this.didResolve = true;

    const ascend = (depth: number) => {
      while (ancestors.length > depth) {
        const finished = ancestors.pop()!;
        finished.item.children.replace(finished.children);
      }
    };

    parseTestsFile(content, {
      onTest: (range, name) => { 
        const parent = ancestors[ancestors.length - 1];
        const data = new TestCase(name, thisGeneration);
        const id = `${item.uri}/${data.getLabel()}`;        

        const tcase = controller.createTestItem(id, data.getLabel(), item.uri);
        testData.set(tcase, data);
        tcase.range = range;
        parent.children.push(tcase);
      },

      onHeading: (range, name, depth) => {
        ascend(depth);
        const parent = ancestors[ancestors.length - 1];
        const id = `${item.uri}/${name}`;

        const thead = controller.createTestItem(id, name, item.uri);
        thead.range = range;
        testData.set(thead, new TestHeading(thisGeneration));
        parent.children.push(thead);
        ancestors.push({ item: thead, children: [] });
      },
    });

    ascend(0); // finish and assign children for all remaining items
  }
}

export class TestHeading {
  constructor(public generation: number) {}
}

export class TestCase {
  constructor(
    private readonly name: String,       
    public generation: number,
    private passed: boolean = true    
  ) {
    this.passed = false;
  }

  getLabel() {
    return `${this.name}`;
  }

    async run(item: vscode.TestItem, options: vscode.TestRun):Promise<void> {
        const start = Date.now();    
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('No folder or workspace opened');
            return;
        }
        let wsFolderUri = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let execPath = join(wsFolderUri, getExecutableFilename());      

        let result = await execShellCommand(execPath + ' ' + this.name);   
        const duration = Date.now() - start;
        if (!result.passed) {                   
            let message = new vscode.TestMessage(result.stderr); 
            message.location = new vscode.Location(item.uri!, item.range!);
            options.failed(item, message, duration);
        }else {       
            let valgrindResult = await execShellCommand('valgrind --leak-check=full --show-leak-kinds=all --error-exitcode=1 ' + execPath + ' ' + this.name);        
            if (!valgrindResult.passed) {                             
                let message = new vscode.TestMessage(valgrindResult.stderr); 
                message.location = new vscode.Location(item.uri!, item.range!);
                options.failed(item, message, duration);
            }else {
                options.passed(item, duration);
            }        
        } 
    }
}  
