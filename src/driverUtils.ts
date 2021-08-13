import * as vscode from 'vscode';
import { TextEncoder } from 'util';
import { posix } from 'path';
import { TestCase } from './testTree';
import { exit } from 'process';

function getConfiguration(configtype : string) : {[key : string] : string}  {
    const uTestConfig = vscode.workspace.getConfiguration('cpp-unit-test');
    const config : {[key : string] : string} | undefined = uTestConfig.get(configtype);
    if (config === undefined) { console.log("NEED TO DEFINE " + configtype + " CONFIG"); exit(1); }
    return config; 
}

export function getCleanUpExecutableOnBuild() : string {
    return getConfiguration('build')['cleanUpExecutableOnBuild'];  
}

export function getDriverCleanUpOnBuild() : string {
    return getConfiguration('build')['cleanUpDriverOnBuild'];
}

export function getDriverFilename() : string {
    return getConfiguration('makefile')["driverFilename"];    
}

export function getExecutableFilename() : string {
    return getConfiguration('makefile')["executableFilename"];    
}

export function getMakefileTarget() : string {
    return getConfiguration('makefile')["targetName"];    
}

export const writeLocalFile = async function(filecontents:string, filename:string) {
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

export const generateDriver = async function(queue:{ test: vscode.TestItem; data: TestCase }[]) : Promise<void | null> {
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
      
    let parentFiles : string[] = [];

    let testPairs = "";
    queue.forEach(item => {  
        let name = item.data.getLabel();
        testPairs  += `\t{ "` + name + `", ` + name + ` },\n`;
        let parentFile : string = item.test.id.split('/').filter(value => value.includes(".h"))[0];
        if (!parentFiles.includes(parentFile)) {
            parentFiles.push(parentFile);
        }        
    });  

    let insertLocation = -1;
    driverContents.forEach((line, index) => {
        if (line.includes(`#include "unit_tests.h"`)) {
            insertLocation = index;
        }
    });   

    let firstPart = driverContents.slice(0, insertLocation).join("\n") + "\n";
    parentFiles.forEach(file => {       
        firstPart += `    #include "` + file + `"\n`;       
    });    
  
    let secondInsertLocation = -1;
    driverContents.forEach((line, index) => {
        if (line.includes("std::map<std::string, FnPtr> tests {")) {
            secondInsertLocation = index + 1;
        }
    });       

    if (secondInsertLocation === -1){        
        return Promise.resolve(null);
    }    

    firstPart += driverContents.slice(insertLocation + parentFiles.length, secondInsertLocation).join("\n");
  
    const secondPart = driverContents.slice(secondInsertLocation, driverContents.length).join("\n");    
    const finalDriverContents = firstPart + testPairs + secondPart;
  
    return await writeLocalFile(finalDriverContents, getDriverFilename() );                        
};
              
export const cleanup = async function() {   
    if (getCleanUpExecutableOnBuild()){     
        const folderUri = getCwdUri();
        if (!folderUri) { return; }
        const fileUri = getFileUri(folderUri, getExecutableFilename());
        vscode.workspace.fs.delete(fileUri);    
    }       
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
