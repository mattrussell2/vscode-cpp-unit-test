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
        std::cout << "adding: " << elem << std::endl;
        Node* toAdd = new Node(elem);
        std::cout << "data of toAdd: " << toAdd->data;
        std::cout << "toAdd next: " << toAdd->next;
        //  if (!head) {
        head = toAdd;
        tail = toAdd;
        // } else {
        //     std::cout << "HERE" << std::endl;
        //     toAdd->next = head;
        //     head->prev  = toAdd;
        //     head        = toAdd;
        // }
        size++;
    }

    // void push_back(T elem) {
    //     Node* toAdd = new Node(elem);
    //     if (!tail) {
    //         head = toAdd;
    //         tail = toAdd;
    //     } else {
    //         tail->next  = toAdd;
    //         toAdd->prev = tail;
    //         tail        = toAdd;
    //     }
    //     size++;
    // }

    size_t get_size() { return size; };

    void output(std::ostream& out) {
        Node* curr = head;
        while (curr != nullptr) {
            out << curr->data << " ";
            curr = curr->next;
        }
    }

    private:
    void destroy() {
        clear();
        // tail = nullptr;
        // size = 0;
    }

    void clear() {
        Node* curr = head;
        while (curr != nullptr) {
            std::cout << "HERE" << std::endl;
            Node* tmp = curr->next;
            delete curr;
        }
        // tail = nullptr;
        // size = 0;
        // if (curr == nullptr) return;
        // std::cout << "data: " << curr->data << std::endl;
        // clear(curr->next);
        // delete curr;
    }

    Node*  head;
    Node*  tail;
    size_t size;
};

template<typename T>
std::ostream& operator<<(std::ostream& out, LinkedList<T> lst) {
    lst.output(out);
    return out;
}
