# libp2p-test

Basic libp2p connection test.

1. Clone repo
2. Install deps (`yarn install` or `npm install`)
3. Run first instance via `npm run start`
4. Run second instance with `npm run start2`

Additional options can be supplied, i.e.

- `--port <number>` The actual Libp2p port we are using (30444 and 30555 respectively)
- `--nodes /ip4/127.0.0.1/tcp/30444/ipfs/Qma...,/ip4/127.0.0.1/tcp/30666/ipfs/Qma...`
- `--protocol <string>` Changes the used protocol, default `/substrate/dot/0`
