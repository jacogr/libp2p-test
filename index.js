// Copyright 2018 Jaco Greeff <jacogr@gmail.com>
// SPDX-License-Identifier: MIT

process.env.DEBUG = 'mss*,libp2p*';

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
const nodes = argv.nodes ? argv.nodes.split(',') : [];;
const config = {
  connection: {
    crypto: [ /* secio */ ],
    muxer: [ mplex /* spdy */ ]
  },
  DHT,
  discovery: [ new Railing({ list: nodes }) ],
  transport: [ new TCP() /* new WS() */ ]
};

console.log(`=== creating on port=${port}, nodes=[${nodes.join(',')}]`);

PeerInfo.create(listenerConfig, (error, listenerInfo) => {
  if (error) {
    console.error('=== FATAL', error);
    process.exit(1);
  }

  const listenerId = listenerInfo.id.toB58String();
  const addr = `/ip4/127.0.0.1/tcp/${port}/ipfs/${listenerId}`;

  listenerInfo.multiaddrs.add(addr);

  const peers = [];
  const node = new Libp2p(config, listenerInfo, new PeerBook());
  const dial = (id, peerInfo) => {
    if (peers[id]) {
      return;
    }

    peers[id] = {};

    console.log(`=== dialling ${id}`);

    node.dialProtocol(peerInfo, protocol, (error, conn) => {
      if (error) {
        delete peers[id];
        console.error(`=== ERROR in dialling ${id}`, error);
        return;
      }

      console.log(`=== dialled ${id}`);

      peers[id] = { conn };

      pull(
        pull.values([`hello from ${listenerId.slice(0, 5)}...${listenerId.slice(-5)}`]),
        conn,
        pull.collect((error, data) => {
          if (error) {
            console.error('=== ERROR on outgoing', error);
            return;
          }

          console.log(`=== dialer received "${data.toString()}"`);
        })
      )
    });
  };

  node.on('peer:connect', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`=== event(peer:connect, ${id})`);

    dial(id, peerInfo);
  });

  node.on('peer:disconnect', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    console.log(`=== event(peer:disconnect, ${id})`);

    delete peers[id];
  });

  node.on('peer:discovery', (peerInfo) => {
    const id = peerInfo.id.toB58String();

    if (peers[id] === undefined) {
      console.log(`=== event(peer:discovery, ${id})`);

      dial(id, peerInfo);
    }
  });

  node.handle(
    protocol,
    (protocol, conn) => {
      console.log('=== listener made connection');

      pull(
        conn,
        pull.collect((error, data) => {
          if (error) {
            console.error('=== ERROR on listener receive', error);
            return;
          }

          console.log(`=== listener received "${data.toString()}"`);
        })
      );
    },
    // TODO This is just here for info, can be removed, no need to match
    (protocol, requested, cb) => {
      console.log(`=== incoming protocol ${requested}`);

      cb(null, requested.indexOf(protocol) === 0);
    }
  );

  console.log(`=== starting node ${addr}`);

  // HACK stub floodsub (it is not enabled for Polkadot Rust,
  //      however it is a default for JS, noop the start)
  node._floodSub.start = (cb) => {
    cb();
  };

  node.start((error, result) => {
    if (error) {
      console.error('=== FATAL', error);
      process.exit(1);
    }

    console.log(`=== node started`);
  });
});
