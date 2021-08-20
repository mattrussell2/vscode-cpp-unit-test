#include <iostream>

template<typename T>
class LinkedList {
    private:
    struct Node {
        Node(T value) : data(value), next(nullptr), prev(nullptr){};
        T     data;
        Node* next;
        Node* prev;
    };

    public:
    LinkedList() : head(nullptr), tail(nullptr), size(0){};
    ~LinkedList() { destroy(); };

    void push_front(T elem) {
        Node* toAdd = new Node(elem);
        if (!head) {
            head = toAdd;
            tail = toAdd;
        } else {
            toAdd->next = head;
            head->prev  = toAdd;
            head        = toAdd;
        }
        size++;
    }

    void push_back(T elem) {
        Node* toAdd = new Node(elem);
        toAdd->next = nullptr;
        if (!tail) {
            head = toAdd;
            tail = toAdd;
        } else {
            tail->next  = toAdd;
            toAdd->prev = tail;
            tail        = toAdd;
        }
        size++;
    }

    size_t get_size() { return size; };

    std::ostream& output(std::ostream& out) const {
        Node* curr = head;
        while (curr != nullptr) {
            out << curr->data << " ";
            curr = curr->next;
        }
        return out;
    }

    private:
    void destroy() {
        Node* curr = head;
        while (curr != nullptr) {
            Node* tmp = curr->next;
            delete curr;
            curr = tmp;
        }
        tail = nullptr;
        size = 0;
    }

    Node*  head;
    Node*  tail;
    size_t size;
};

template<typename T>
std::ostream& operator<<(std::ostream& out, const LinkedList<T>& lst) {
    return lst.output(out);
}
