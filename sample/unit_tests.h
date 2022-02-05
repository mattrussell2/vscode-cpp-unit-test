#include <cassert>
#include <iostream>

void test_pass() {
    assert(0 == 0);
}

void test_pass_1() {
    int* x = new int[100];
    delete[] x;
}

void test_fail() {
    assert(1 == 0);
}

void test_fail_valgrind() {
    std::cout << "Hello world!" << std::endl;
    int* x = new int[100];
}

/* diff with file stdout/diff_test_pass has this text */
void diff_test_pass() {
    std::cout << "hello world!" << std::endl;
}

/* file stdout/diff_test_fail has an extra '!' in it */
void diff_test_fail() {
    std::cout << "hello world" << std::endl;
}

void comment_after_line() { // comment here
    std::cout << "hello!";
}

/*
 * void name_in_comment() {
 */
void name_in_comment() {} // some test

// void name_in_inline_comment() {
void name_in_inline_comment() {}

/*
void block_commented_test() {
    std::cout << "don't run me";
}
*/

// void inline_commented_test() {
//    std::cout << "don't run me";
//}

void timeout_test() { 
    std::cout << "testing" << std::endl;        
    while(true) {}
}
