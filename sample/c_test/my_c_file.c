#include "my_c_file.h"
#include <stdbool.h>
#include <stdio.h>

void hello_world() {
    printf("hello world!");
}

bool isPrime(int n) {
    if (n == 0 || n == 1)
        return 0;

    if (n == 2) return 1;

    for (int i = 2; i <= n / 2; i++) {
        if (n % i == 0) {
            return 0;
        }
    }

    return 1;
}