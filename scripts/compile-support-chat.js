#!/usr/bin/env node
/**
 * Compiles contracts/SupportChat.sol and refreshes the committed artifacts.
 *
 * solc is fetched with npx on purpose: the repo's yarn.lock stays untouched and
 * the compiled output is committed, so a deploy never needs a Solidity toolchain.
 *
 * Usage: node scripts/compile-support-chat.js
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SOLC_VERSION = '0.8.24'
const BUILD_DIR = path.join(ROOT, 'contracts', 'build')
const ARTIFACT_BASE = path.join(BUILD_DIR, 'contracts_SupportChat_sol_SupportChat')

const TARGETS = [
    ['contracts/SupportChat.abi.json', 'abi'],
    ['contracts/SupportChat.bin', 'bin'],
    ['src/components/chatSupport/supportChatAbi.json', 'abi'],
]

const main = () => {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true })

    execFileSync(
        'npx',
        [
            '--yes',
            `solc@${SOLC_VERSION}`,
            '--bin',
            '--abi',
            '--optimize',
            '--optimize-runs',
            '200',
            '-o',
            BUILD_DIR,
            'contracts/SupportChat.sol',
        ],
        { cwd: ROOT, stdio: 'inherit' }
    )

    const abi = JSON.parse(fs.readFileSync(`${ARTIFACT_BASE}.abi`, 'utf8'))
    const bytecode = fs.readFileSync(`${ARTIFACT_BASE}.bin`, 'utf8').trim()

    TARGETS.forEach(([file, kind]) => {
        const body = kind === 'abi' ? `${JSON.stringify(abi, null, 2)}\n` : `${bytecode}\n`

        fs.writeFileSync(path.join(ROOT, file), body)
        console.log(`updated ${file}`)
    })

    fs.rmSync(BUILD_DIR, { recursive: true, force: true })
}

try {
    main()
} catch (error) {
    console.error(`✖ ${error.message}`)
    process.exit(1)
}
