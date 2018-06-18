# libp2p-test

Basic libp2p connection test.

1. Clone repo
2. Install deps with `yarn install`
3. Run first instance via `yarn run start`
4. Run second instance with `yarn run start2`

To make a connection to a pre-configured node running on `30333`, you can use `yarn run start3`

Additional options can be supplied, i.e.

- `--port <number>` The actual Libp2p port we are using (30444 and 30555 respectively)
- `--nodes /ip4/127.0.0.1/tcp/30444/ipfs/Qma...,/ip4/127.0.0.1/tcp/30666/ipfs/Qma...`
- `--protocol <string>` Changes the used protocol, default `/substrate/dot/0`
