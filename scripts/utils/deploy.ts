const hre = require("hardhat");

function sleep(ms : number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deployVerify(contractName : string, ...args : any) : Promise<any> {
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);
    if(hre.network.name == "hardhat") return contract;
    console.log("Waiting a minute...");
    await sleep(60000);
    await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: args,
        network: "rinkeby"
    }).catch((err : any) => {
        console.log("Failed to verify : ", err)
    })
    return contract;
}