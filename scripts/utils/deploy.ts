const hre = require("hardhat");

function sleep(ms : number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deployVerify(contractName : string, ...args : any) : Promise<any> {
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);
    if(hre.network.name == "hardhat") return [null, contract];
    return [new Promise<any>(async (resolve, reject) => {
        await sleep(100000);
        await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: args,
            network: "rinkeby"
        }).catch(async (err : any) => {
            await hre.run("verify:verify", {
                address: contract.address,
                constructorArguments: args,
                network: "rinkeby"
            }).catch((err : any) => {
                reject("Failed to verify : " + err);
            });
        });
        resolve("ok");
    }), contract];
    
}

export async function deploy(contractName : string, ...args : any) : Promise<any> {
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);
    return contract;
}