// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@balancer-labs/v2-solidity-utils/contracts/math/Math.sol';

library DepositsLinkedList {
    using Math for uint256;

    struct Deposit {
        uint256 amount;
        uint256 timestamp;
    }

    struct Node {
        Deposit deposit;
        uint next;
    }

    struct List {
        mapping(uint => Node) nodes;
        uint head;
        uint tail;
        uint length;
        uint nodeIdCounter;
    }

    uint private constant NULL = 0; // Represent the 'null' pointer

    function initialize(List storage list) internal {
        list.head = list.tail = NULL;
        list.nodeIdCounter = 1; // Initialize node ID counter
    }

    function insertEnd(List storage list, Deposit memory _deposit) internal {
        uint newNodeId = list.nodeIdCounter++; // Use and increment the counter for unique IDs
        list.nodes[newNodeId] = Node(_deposit, NULL);
        if (list.head == NULL) {
            list.head = list.tail = newNodeId;
        } else {
            list.nodes[list.tail].next = newNodeId;
            list.tail = newNodeId;
        }
        list.length++;
    }

    function popHead(List storage list) internal {
        require(list.head != NULL, "List is empty, cannot pop head.");
        uint oldHead = list.head;
        list.head = list.nodes[oldHead].next;
        delete list.nodes[oldHead];
        list.length--;
        if (list.head == NULL) {
            list.tail = NULL; // Reset the tail if the list is empty
        }
    }

    function sumExpiredDeposits(List storage list, uint256 lock_duration) internal view returns (uint256 sum) {
        uint current = list.head;

        while (current != NULL) {
            if (lock_duration == 0 || ((block.timestamp - list.nodes[current].deposit.timestamp) > lock_duration)) {
                sum = sum.add(list.nodes[current].deposit.amount);
            }
            current = list.nodes[current].next;
        }

        return sum;
    }

    function modifyDepositAmount(List storage list, uint nodeID, uint256 newAmount) internal {
        Node storage node = list.nodes[nodeID];
        node.deposit.amount = newAmount;
    }

    function getDepositById(List storage list, uint id) internal view returns (Deposit memory) {
        require(id != NULL, "Invalid ID: ID cannot be zero.");
        require(list.nodes[id].next != NULL || id == list.head, "Node does not exist.");

        return list.nodes[id].deposit;
    }
}
