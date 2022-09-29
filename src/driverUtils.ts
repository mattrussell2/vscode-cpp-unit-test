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

function getBoolConfiguration(configtype : string) : {[key : string] : boolean}  {
    const uTestConfig = vscode.workspace.getConfiguration('cpp-unit-test');
    const config : {[key : string] : boolean} | undefined = uTestConfig.get(configtype);
    if (config === undefined) { console.log("NEED TO DEFINE " + configtype + " CONFIG"); exit(1); }
    return config; 
}

export function getValgrindFlags() : string {
    return getConfiguration('valgrind')['valgrindFlags'];
}

export function getRunWithValgrind() : boolean {
    return getBoolConfiguration('valgrind')['runWithValgrind'];         
}

export function getTimeoutTime() : string {
    return getConfiguration('run')['timeoutTime'];
}

export function getValgrindTimeoutTime() : string {
    return getConfiguration('run')['valgrindTimeoutTime'];
}

export function getRunMakeCleanOnExit() : boolean {
    return getBoolConfiguration('build')['runMakeCleanOnExit'];    
}
export function getCleanUpExecutableOnBuild() : boolean {
    return getBoolConfiguration('build')['cleanUpExecutableOnBuild'];  
}

export function getDriverCppCleanUpOnBuild() : string {
    return getConfiguration('build')['cleanUpDriverCppOnBuild'];
}

export function getDriverFileName() : string {
    return getConfiguration('makefile')["driverFileName"];    
}

export function getExecutableFileName() : string {
    return getConfiguration('makefile')["executableFileName"];    
}

export function getMakefileTarget() : string {
    return getConfiguration('makefile')["targetName"];    
}


// export function getUseExternC() : boolean {
//     return getBoolConfiguration('build')['useExternC'];
// }

export const writeLocalFile = async function(filecontents:string, fName:string) {   
    const fileUri = getFileUri(getCwdUri(), fName);
    var enc = new TextEncoder();
    var encodedDriverContents = enc.encode(filecontents);
    return await vscode.workspace.fs.writeFile(fileUri, encodedDriverContents);                
};

export function getFileUri(folderUri:vscode.Uri, fName:string) {
    return folderUri.with({ path: posix.join(folderUri.path, fName) });
}

export function getCwdUri() {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showInformationMessage('No folder or workspace opened!');
        exit(1);        
    } 
    return vscode.workspace.workspaceFolders[0].uri;
}

export const generateDriver = 
    async function(queue: { test: vscode.TestItem; data: TestCase }[])
                                                       : Promise<void | null> {
    // create driver file and auto-populate it
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
        let parentFile : string = 
              item.test.id.split('/').filter(value => value.includes(".h"))[0];
        
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
    
    // if (getUseExternC()) {
    //     firstPart += 'extern \"C\" {\n';
    // }
    parentFiles.forEach(file => {       
        firstPart += `    #include "` + file + `"\n`;       
    }); 
    // if (getUseExternC()) {
    //     firstPart += '}\n';
    // }   
  
    let secondInsertLocation = -1;
    driverContents.forEach((line, index) => {
        if (line.includes("std::map<std::string, FnPtr> tests {")) {
            secondInsertLocation = index + 1;
        }
    });       

    if (secondInsertLocation === -1) {        
        return Promise.resolve(null);
    }    

    firstPart += driverContents.slice(insertLocation + parentFiles.length, secondInsertLocation).join("\n");
  
    const secondPart          = driverContents.slice(secondInsertLocation, driverContents.length).join("\n");    
    const finalDriverContents = firstPart + testPairs + secondPart;
    return await writeLocalFile(finalDriverContents, "unit_test_driver.cpp");                        
};

export const cleanup = async function() {       
    if (getDriverCppCleanUpOnBuild()) {
        vscode.workspace.fs.delete(getFileUri(getCwdUri(), "unit_test_driver.cpp"));
    }
    if (getCleanUpExecutableOnBuild()) {                     
        vscode.workspace.fs.delete(getFileUri(getCwdUri(), getExecutableFileName()));    
    }          
    if (getRunMakeCleanOnExit()) {
        await execShellCommand("make clean");
    }
};


export const execShellCommand =
 async function(cmd: string, fsPathDict: Object={}, timeout?:string) : Promise<any> {
    
    const exec = require('child_process').exec;
    
    console.log(timeout);
    if (timeout) {
        console.log("HERE");
        cmd = "timeout --preserve-status " + timeout + " " + cmd;
    }
    console.log(cmd);

    return new Promise((resolve, reject) => {
        exec(cmd, 
             fsPathDict, 
             (error:NodeJS.ErrnoException, stdout:string, stderr:string) => {
        
        let result = {'passed': false, 'stdout':"", 'stderr':"", 'exitcode':""};      
        if (error) {
            result.passed = false;
            if (error.code){
                result.exitcode = error.code;
                console.log("exitcode: " + result.exitcode);
            } 
        }else{
            result.passed = true;
            result.exitcode = '0';
        }
                
        result.stdout = stdout;
        result.stderr = stderr;
        resolve(result);     
        });
    });
};
