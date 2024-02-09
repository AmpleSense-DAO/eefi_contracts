// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

contract DepositsLinkedList {

    struct Deposit {
        uint256 amount;
        uint256 timestamp;
    }

    struct Node {
        Deposit deposit;
        uint next;
    }

    mapping(uint => Node) public nodes;
    uint public head;
    uint public tail;
    uint public length = 0;
    uint private constant NULL = 0; // Represent the 'null' pointer
    uint private nodeIdCounter = 1;

    constructor() {
        head = tail = NULL;
    }

    // Insert a node at the end of the list
    function insertEnd(Deposit memory _deposit) public {
        uint newNodeId = nodeIdCounter++; // Use and increment the counter for unique IDs
        nodes[newNodeId] = Node(_deposit, NULL);
        if (head == NULL) {
            head = tail = newNodeId;
        } else {
            nodes[tail].next = newNodeId;
            tail = newNodeId;
        }
        length++;
    }

    // Adjusted popHead function
    function popHead() public {
        require(head != NULL, "List is empty, cannot pop head.");
        uint oldHead = head;
        head = nodes[oldHead].next;
        delete nodes[oldHead];
        length--;
        if (head == NULL) {
            tail = NULL; // Reset the tail if the list is empty
        }
    }

    // Traverse the list and sum all expired deposits amounts
    function sumExpiredDeposits(uint256 lock_duration) public view returns (uint256 sum) {
        uint current = head; // Start traversal from the head of the list
        sum = 0; // Initialize sum of amounts

        // Traverse the list until the end
        while (current != NULL) {
            // Check if the deposit has expired
            if ((block.timestamp - nodes[current].deposit.timestamp) > lock_duration) {
                // Add the current node's deposit amount to the sum if it has expired
                sum += nodes[current].deposit.amount;
            }
            // Move to the next node
            current = nodes[current].next;
        }

        return sum;
    }

    // Modify the amount of a deposit
    function modifyDepositAmount(uint nodeID, uint256 newAmount) public {
        Node storage node = nodes[nodeID];
        node.deposit.amount = newAmount;
    }


    // Get the Deposit data of a node by its ID
    function getDepositById(uint id) public view returns (Deposit memory) {
        require(id != NULL, "Invalid ID: ID cannot be zero.");
        require(nodes[id].next != NULL || id == head, "Node does not exist.");

        return nodes[id].deposit;
    }
}