import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { parseTestsFile } from './parser';
import { join } from 'path';
import { execShellCommand, getCwdUri, getExecutableFileName, 
         getTimeoutTime, getValgrindTimeoutTime, writeLocalFile, 
         getRunWithValgrind, getValgrindFlags } from './driverUtils';
import { existsSync, unlinkSync } from 'fs';

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

    public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
        try {
            // item is the unit_tests.h file -> content is the string of the file        
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
    public updateFromContents(controller: vscode.TestController, 
                              content: string, 
                              item: vscode.TestItem) {
        const ancestors = [{ item, children: [] as vscode.TestItem[]}];
        console.log("ancestors", ancestors);

        const thisGeneration = generationCounter++;
        this.didResolve = true;

        const ascend = (depth: number) => {
            while (ancestors.length > depth) {
                const finished = ancestors.pop()!;
                console.log("ascending");
                console.log(finished.item);
                finished.item.children.replace(finished.children);
            }
        };

        parseTestsFile(content, {
            onTest: (range, name) => { 
                console.log("parsing tests file -- name: ", name);
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

    async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
        const start = Date.now();    
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('No folder or workspace opened');
            return;
        }
        let wsFolderUri = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let execPath = join(wsFolderUri, getExecutableFileName());      

        let timeouttime = getTimeoutTime().toString();
        let valgrindtimeouttime = getValgrindTimeoutTime().toString();
        let result = await execShellCommand('timeout --preserve-status ' + timeouttime + ' ' +
                                             execPath + ' ' + this.name);   
        const duration = Date.now() - start;
        if (!result.passed) {                   
            let message = new vscode.TestMessage("");            
            if (result.exitcode === 143) {
                message = new vscode.TestMessage("stdout: " + result.stdout +
                                                 "\n stderr: code timed out (>" + timeouttime + 
                                                 "s to run) while running test");
            }else {                                              
                message = new vscode.TestMessage("stdout: " + result.stdout + "\n stderr: " +   
                                                 result.stderr);                                     
            }
            message.location = new vscode.Location(item.uri!, item.range!);
            options.failed(item, message, duration);
        } else {      
            let valgrindResult = null; 
            if (getRunWithValgrind()) {                
                valgrindResult = await execShellCommand('timeout --preserve-status ' + 
                                                        valgrindtimeouttime + ' valgrind ' + 
                                                        getValgrindFlags() + ' --error-exitcode=1 ' 
                                                        + execPath + ' ' + this.name);                                
                if (!valgrindResult.passed) {
                    let message = new vscode.TestMessage("");
                    if (valgrindResult.exitcode === 143) {
                        message = new vscode.TestMessage("stdout: " + valgrindResult.stdout + 
                                                        "\n stderr: valgrind timed out (>" + 
                                                        valgrindtimeouttime + 
                                                        "s to run while running test");
                    }else {                             
                        message = new vscode.TestMessage("stdout: " + valgrindResult.stdout + 
                                                        "\n stderr: " + valgrindResult.stderr); 
                    }
                    message.location = new vscode.Location(item.uri!, item.range!);
                    options.failed(item, message, duration);
                }
            }
            if ((getRunWithValgrind() && valgrindResult.passed) || !getRunWithValgrind()) {         
                const testFilePath = join(wsFolderUri, 'stdout/' +  this.name);                
                if (existsSync(testFilePath)) {
                    await writeLocalFile(result.stdout, 'tmp');
                    let diffResult = await execShellCommand('diff ' + wsFolderUri + '/tmp ' +
                                                             wsFolderUri + '/stdout/' + this.name);
                    if (!diffResult.passed) {
                        let message = new vscode.TestMessage("diff failed! \n" + diffResult.stderr 
                                                            + '\n' + diffResult.stdout); 
                        message.location = new vscode.Location(item.uri!, item.range!);
                        options.failed(item, message, duration); 
                    }else {                    
                        options.passed(item, duration);
                    } 
                    unlinkSync(wsFolderUri + '/tmp');
                }
                else {                
                    options.passed(item, duration);                
                }                                    
            }
        } 
    }
}  
