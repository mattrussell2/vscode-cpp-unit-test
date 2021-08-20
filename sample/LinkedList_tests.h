#include "LinkedList.h"
#include <cassert>
#include <iostream>
#include <sstream>

void push_front_0() {
    LinkedList<int> l;
    assert(l.get_size() == 0);
    l.push_front(10);
    assert(l.get_size() == 1);
    std::stringstream s;
    s << l;
    assert(s.str() == "10 ");
}

void push_front_1() {
    LinkedList<int> l;
    std::string     s = "";
    for (int i = 0; i < 10; i++) {
        assert(l.get_size() == i);
        l.push_front(i);
        s = std::to_string(i) + " " + s;
        std::stringstream strstream;
        strstream << l;
        assert(strstream.str() == s);
    }
}


void push_back_0() {
    LinkedList<int> l;
    assert(l.get_size() == 0);
    l.push_back(10);
    assert(l.get_size() == 1);
    std::stringstream s;
    s << l;
    assert(s.str() == "10 ");
}

void push_back_1() {
    LinkedList<int> l;
    std::string     s = "";
    for (int i = 0; i < 10; i++) {
        assert(l.get_size() == i);
        l.push_back(i);
        s += std::to_string(i) + " ";
        std::stringstream strstream;
        strstream << l;
        assert(strstream.str() == s);
    }
}

void fail() {
    assert(1 == 0);
}