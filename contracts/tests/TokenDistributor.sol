// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TokenDistributor {

    IERC20 ampl;
    IERC20 eefi;
    IERC20 kmpl;
    IERC20 kmplethlp;
    IERC20 eefiethlp;
    IERC721 nft1;
    IERC721 nft2;
    uint256 nft1ID = 99;
    uint256 nft2ID = 99;

    constructor(IERC20 _ampl_token, IERC20 _eefi_token, IERC20 _kmpl_token, IERC20 _kmplethlp, IERC20 _eefiethlp, IERC721 _nft1, IERC721 _nft2) {
        ampl = _ampl_token;
        eefi = _eefi_token;
        kmpl = _kmpl_token;
        kmplethlp = _kmplethlp;
        eefiethlp = _eefiethlp;
        nft1 = _nft1;
        nft2 = _nft2;
    }

    function getAMPL() external {
        ampl.transfer(msg.sender, 10000 * 10**9);
    }

    function getEEFI() external {
        eefi.transfer(msg.sender, 1000 * 10**9);
    }

    function getKMPL() external {
        kmpl.transfer(msg.sender, 1000 * 10**9);
    }

    function getKMPLETHLP() external {
        kmplethlp.transfer(msg.sender, 10**15);
    }

    function getEEFIETHLP() external {
        eefiethlp.transfer(msg.sender, 10**15);
    }

    function getToken1() external {
        nft1.transferFrom(address(this), msg.sender, nft1ID++);
    }

    function getToken2() external {
        nft2.transferFrom(address(this), msg.sender, nft2ID++);
    }
}