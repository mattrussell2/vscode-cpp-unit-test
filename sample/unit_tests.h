#include <cassert>
#include <iostream>

// TESTSET PASS
void test_pass() {
    assert(0 == 0);
}

// TESTSET FAIL
void test_fail() {
    assert(0 == 1);
}
