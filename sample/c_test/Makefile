CXX = clang++
CX  = clang

unit_test: unit_test_driver.o my_c_file.o
	$(CXX) unit_test_driver.o my_c_file.o

my_c_file.o: my_c_file.c 
	$(CX) -c my_c_file.c