import {config} from "@onflow/config"

const noop = () => {}

const DEFAULT_APP_METADATA = {
  name: "Flow App",
  description: "Flow DApp for WalletConnect",
  url: "https://testFlow.com/",
  icons: ["https://avatars.githubusercontent.com/u/62387156?s=280&v=4"],
}

const checkPersistedState = async client => {
  let pairings, storedSession
  if (typeof client === "undefined") {
    throw new Error("WalletConnect is not initialized")
  }
  // if (client.pairing.topics.length) {
  //   pairings = client.pairing.values
  // }
  console.log("client.session ->", client.session)
  if (client.session && client.session.values.length > 0) {
    // storedSession = await client.session.get(client.session.values[0].topic)
    storedSession = await client.session.get(client.session.values[0].topic)
  }
  return {pairings, storedSession}
}


const connectWc = async (client, QRCodeModal) => {
  try {
    console.log('client, QRCodeModal ->', client, QRCodeModal)
    const { uri, approval } = await client.connect({
      metadata: DEFAULT_APP_METADATA,
      requiredNamespaces: {
        flow: {
          methods: ["flow_signMessage", "flow_authz", "flow_authn"],
          chains: ["flow:testnet"],
          events: ["chainChanged", "accountsChanged"]
        },
      },
    })

    if (uri) {
      QRCodeModal.open(uri, () => {
        console.log("EVENT", "QR Code Modal closed")
      })
    }

    const session = await approval();
    return session
  } catch (e) {
    console.error(e)
  } finally {
    QRCodeModal.close()
  }
}

export async function wc(service, body, opts = {}) {
  if (service == null) return {send: noop, close: noop}
  console.log('wc 11-->', service)
  const onReady = opts.onReady || noop
  const onResponse = opts.onResponse || noop
  const onClose = opts.onClose || noop
  const {client, QRCodeModal} = await config.get("wc.adapter")
  const {pairings, storedSession} = await checkPersistedState(client)

  const send = msg => {
    try {
      console.log("Send", msg)
    } catch (error) {
      console.error("Ext Send Error", msg, error)
    }
  }

  const close = () => {
    try {
      onClose()
    } catch (error) {
      console.error("Ext Close Error", error)
    }
  }

  // if pairings === true, need user input, openPairingModal() to select?
  let session = storedSession
  if (session == null) {
    session = await connectWc(client, QRCodeModal)
  }

  console.log("service ->", service)

  if (service.endpoint === "flow_authn") {
    try {
      console.log('{client, QRCodeModal}  ->', client, QRCodeModal)
      console.log("<--- handle Authn 11 -->", service.endpoint)
      const result = await client.request({
        topic: session.topic,
        chainId: "flow:testnet",
        request: {
          method: service.endpoint,
          params: [],
        },
      })
      onResponse(result, {
        close: () => QRCodeModal.close(),
      })
      console.log(' handle Authn client ->', result)
    } catch (e) {
      console.error(e)
    }
  }

  if (service.endpoint === "flow_authz") {
    try {
      console.log("<--- handle Authz -->", service, body)
      const result = await client.request({
        topic: session.topic,
        chainId: "flow:testnet",
        request: {
          method: service.endpoint,
          params: JSON.stringify(body),
        },
      })

      onResponse(result, {
        close: () => QRCodeModal.close(),
      })
      console.log(' handle Authz ->', result)
    } catch (e) {
      console.error(e)
    }
  }

  return {send, close}
}
