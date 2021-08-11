#include <cassert>
#include <iostream>

// TESTSET PASS
void test_pass() {
    assert(0 == 0);
}

void test_pass_0() {
    assert(1 == 1);
}

// TESTSET FAIL
void test_fail() {
    assert(0 == 1);
}

// VALGRIND FAIL
void valgrind_fail() {
    int* x = new int[100];
}