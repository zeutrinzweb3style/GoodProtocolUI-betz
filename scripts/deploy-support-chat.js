#!/usr/bin/env node
/**
 * Deploys contracts/SupportChat.sol to Celo and prints the two environment
 * variables the widget needs.
 *
 * The contract is ownerless on purpose (see docs/SUPPORT_CHAT_PROPOSAL.md), so
 * this script is the only privileged step and it never runs again afterwards.
 *
 * Usage:
 *   SUPPORT_CHAT_DEPLOY_KEY=0x... node scripts/deploy-support-chat.js
 *
 * Optional:
 *   REACT_APP_WEB3_RPC_CELO=https://forno.celo.org
 */
const fs = require('fs')
const path = require('path')
const Web3 = require('web3')

const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.REACT_APP_WEB3_RPC_CELO || 'https://forno.celo.org'
const DEPLOY_GAS = 600000
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/

const fail = (message) => {
    console.error(`✖ ${message}`)
    process.exit(1)
}

const main = async () => {
    const privateKey = String(process.env.SUPPORT_CHAT_DEPLOY_KEY || '').trim()

    if (!PRIVATE_KEY_PATTERN.test(privateKey)) {
        fail('Set SUPPORT_CHAT_DEPLOY_KEY to a 0x-prefixed 32-byte private key (66 characters).')
    }

    const abi = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'SupportChat.abi.json'), 'utf8'))
    const bytecode = `0x${fs.readFileSync(path.join(ROOT, 'contracts', 'SupportChat.bin'), 'utf8').trim()}`

    const web3 = new Web3(RPC)
    const { address } = web3.eth.accounts.wallet.add(privateKey)
    const balance = await web3.eth.getBalance(address)

    console.log(`rpc       : ${RPC}`)
    console.log(`deployer  : ${address}`)
    console.log(`balance   : ${web3.utils.fromWei(balance, 'ether')} CELO`)

    if (BigInt(balance) === BigInt(0)) fail('The deployer wallet has no CELO for gas.')

    let receipt = null

    const instance = await new web3.eth.Contract(abi)
        .deploy({ data: bytecode })
        .send({ from: address, gas: DEPLOY_GAS })
        .on('transactionHash', (hash) => console.log(`tx        : ${hash}`))
        .on('receipt', (result) => {
            receipt = result
        })

    const deployBlock = receipt ? receipt.blockNumber : await web3.eth.getBlockNumber()
    const contractAddress = instance.options.address

    console.log(`\n✔ SupportChat deployed at ${contractAddress} (block ${deployBlock})\n`)
    console.log('Add these to the Vercel project (Environment Variables), then redeploy:\n')
    console.log(`REACT_APP_SUPPORT_CHAT_CONTRACT=${contractAddress}`)
    console.log(`REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK=${deployBlock}`)
}

main().catch((error) => fail(error.message))
