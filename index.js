// Copyright 2018 Jaco Greeff <jacogr@gmail.com>
// SPDX-License-Identifier: MIT

process.env.DEBUG = 'libp2p*';

const Libp2p = require('libp2p');
const DHT = require('libp2p-kad-dht');
const mplex = require('libp2p-mplex');
// const Multicast = require('libp2p-mdns');
const Railing = require('libp2p-railing');
// const secio = require('libp2p-secio');
const spdy = require('libp2p-spdy');
const TCP = require('libp2p-tcp');
const PeerBook = require('peer-book');
const PeerInfo = require('peer-info');
// const WS = require('libp2p-websockets');
const peerA = require('./peerA.json');
const peerB = require('./peerB.json');
const pull = require('pull-stream');
const argv = require('yargs').argv;

const listenerConfig = { 'A': peerA, 'B': peerB }[argv.id || 'A'];
const protocol = argv.protocol || '/substrate/dot/0';
const port = argv.port || 30333;
const nodes = argv.nodes ? argv.nodes.split(',') : [];
const peers = [];
const config = {
  connection: {
    crypto: [ /* secio */ ],
    muxer: [ mplex /* spdy */ ]
  },
  DHT,
  discovery: [ new Railing({ list: nodes }) ],
  transport: [ new TCP() /* new WS() */ ]
};

console.log(`creating listener with port=${port}, nodes=[${nodes.join(',')}]`);

PeerInfo.create(listenerConfig, (error, listenerInfo) => {
  if (error) {
    console.error('FATAL', error);
    process.exit(1);
  }

  const listenerId = listenerInfo.id.toB58String();
  const addr = `/ip4/127.0.0.1/tcp/${port}/ipfs/${listenerId}`;

  console.log(`created listener ${addr}`);
  listenerInfo.multiaddrs.add(addr);

  const node = new Libp2p(config, listenerInfo, new PeerBook());

  const dial = (id, peerInfo) => {
    if (peers[id]) {
      return;
    }

    console.log(`dial to ${id}`);

    node.dial(peerInfo, (error) => {
      if (error) {
        console.error(`ERROR in dial ${id}`, error);
        return;
      }

      node.dialProtocol(peerInfo, protocol, (error, conn) => {
        if (error) {
          console.error(`ERROR in dialProtocol ${id}`, error);
          return;
        }

        console.log(`dial success ${id}`);

        peers[id] = conn;

        pull(
          pull.values([`hello from ${listenerId}`]),
          conn,
          pull.collect((error, data) => {
            if (error) {
              return;
            }

            console.log(`dialer received "${data.toString()}"`);
          })
        )
      });
    });
  };

  node.switch.on('peer-mux-established', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`peer-mux-established ${id}`);
  });

  node.on('peer:connect', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`peer:connect ${id}`);

    dial(id, peerInfo);
  });

  node.on('peer:disconnect', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`peer:disconnect ${id}`);

    delete peers[id];
  });

  node.on('peer:discovery', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`peer:discovery ${id}`);

    dial(id, peerInfo);
  });

  console.log('starting node instance');

  node.handle(
    protocol,
    (protocol, conn) => {
      pull(
        conn,
        pull.collect((error, data) => {
          if (error) {
            return;
          }

          console.log(`listener received "${data.toString()}"`);
        })
      );
    },
    (protocol, requested, cb) => {
      console.log(`incoming protocol ${requested}`);

      cb(null, requested.indexOf(protocol) === 0);
    }
  );

  node.start((error, node) => {
    if (error) {
      console.error('FATAL', error);
      process.exit(1);
    }

    console.log('node started');
  });
});
