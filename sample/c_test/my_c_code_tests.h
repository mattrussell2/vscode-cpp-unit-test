extern "C" {
#include "my_c_file.h"
}
#include <cassert>
#include <iostream>

void my_c_code_test() {
    hello_world();
    assert(isPrime(2) == 1);
    assert(isPrime(3) == 1);
    assert(isPrime(4) == 0);
}