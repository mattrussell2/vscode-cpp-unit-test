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
    int* x = new int[100];
}

void diff_test_pass() {
    std::cout << "hello world!" << std::endl;
}

void diff_test_fail() {
    std::cout << "hello world" << std::endl;
}