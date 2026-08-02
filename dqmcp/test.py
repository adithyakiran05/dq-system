import sys
import server
import json

def test():
    print("Testing get_profiles for table 'staff'...")
    res = server.get_profiles('staff')
    print(res)

if __name__ == '__main__':
    test()
