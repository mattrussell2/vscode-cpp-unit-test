import * as vscode from 'vscode';
import { TextEncoder } from 'util';
import { posix } from 'path';
import { TestCase } from './testTree';

const driverFileName = "unit_test_driver.cpp";
const utestExecName = "a.out";


export const writeLocalFile = async function(filecontents:string, filename:string) {
    let sendback: { [index: string]: vscode.Uri };

    const folderUri = getCwdUri();     
    if (!folderUri) { return null; }   
    const fileUri = getFileUri(folderUri, filename);
    var enc = new TextEncoder();
    var encodedDriverContents = enc.encode(filecontents);
    return await vscode.workspace.fs.writeFile(fileUri, encodedDriverContents);                
};

export function getFileUri(folderUri:vscode.Uri, filename:string) {
    return folderUri.with({ path: posix.join(folderUri.path, filename) });
}


export function getCwdUri() {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showInformationMessage('No folder or workspace opened');
        return;
    } 
    return vscode.workspace.workspaceFolders[0].uri;
}

export const generateDriver = async function(queue:{ test: vscode.TestItem; data: TestCase }[]) {
    // create unit-test-driver.cpp and auto-populate it
    let driverContents = `
    /*
    unit_test_driver.cpp
    Matt Russell
    COMP15 2020 Summer
    Updated 12/16/2020

    This file is used as the driver for unit testing.

    The 'tests' map will be auto-populated in the form:

        { "test_name", test_name }

    Where "test_name" maps to the associated test function in unit_tests.h.
    */

    #include <map>
    #include <string>
    #include <iostream>
    #include "unit_tests.h"

    typedef void (*FnPtr)();

    int main(int argc, char **argv) {

        /* will be filled in by the unit_test script */
        std::map<std::string, FnPtr> tests {

        };

        /* first argument to main() is the string of a test function name */
        if (argc <= 1) {
            std::cout << "No test function specified. Quitting" << std::endl;
            return 1;
        }

        /* extract the associated fn pointer from "tests", and run the test */
        FnPtr fn = tests[argv[1]];
        fn();

        return 0;
    }`.split("\n");
      

    let testPairs = "";
    queue.forEach(item => {  
        let name = item.data.getLabel();
        testPairs  += `\t{ "` + name + `", ` + name + ` },\n`;
    });  

    let insertLocation = -1;;
    driverContents.forEach((line, index) => {
        if (line.includes("std::map<std::string, FnPtr> tests {")) {
            insertLocation = index + 1;
        }
    });

    if (insertLocation === -1){
        console.log("something failed while building driver.");
        return;
    }    
    const firstPart = driverContents.slice(0,insertLocation).join("\n");
    const secondPart = driverContents.slice(insertLocation, driverContents.length).join("\n");    
    const finalDriverContents = firstPart + testPairs + secondPart;
    
    const folderUri = getCwdUri();     
    if (!folderUri) { return; }
    await writeLocalFile(finalDriverContents, driverFileName);
           
    // let's run make after parsing the test file.    
    let makeResult = await execShellCommand('make unit-test', {cwd: folderUri.fsPath});
    if (makeResult.passed) {        
        const fileUri = getFileUri(folderUri,driverFileName);     
        vscode.workspace.fs.delete(fileUri);  
    }              
};
              
export const cleanup = async function() {        
    const folderUri = getCwdUri();
    if (!folderUri) { return; }
    const fileUri = getFileUri(folderUri, utestExecName);
    vscode.workspace.fs.delete(fileUri);           
};



export const execShellCommand = async function(cmd:string, fsPathDict:Object={}):Promise<any> {
    const exec = require('child_process').exec;
    
    return new Promise((resolve, reject) => {
     exec(cmd, fsPathDict,(error:string, stdout:string, stderr:string) => {
        let result = {'passed':false, 'stdout':"", 'stderr':''};      
        error ? result.passed = false : result.passed = true;
        result.stdout = stdout;
        result.stderr = stderr;
        resolve(result);     
        });
    });
};
