#include "LinkedList.h"
#include <cassert>
#include <iostream>
#include <sstream>

void test_insert() {
    LinkedList<int> l;
    assert(l.get_size() == 0);
    l.push_front(10);
    std::cout << l << std::endl;
    assert(l.get_size() == 1);
    std::stringstream s;
    s << l;
    assert(s.str() == "10 ");
}