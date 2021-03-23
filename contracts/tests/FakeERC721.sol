pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract FakeERC721 is ERC721 {
    uint256 id;
    constructor() public ERC721("fake", "fake") {
        for(uint i = 0; i < 20; i++) {
            _mint(msg.sender, id++);
        }
    }
}