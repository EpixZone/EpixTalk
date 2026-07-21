/**
 * EpixKit - Wallet connection library for Epix Chain dApps
 * https://github.com/EpixZone/epixkit
 * MIT License
 */
(function() {
 "use strict"

 var config = null
 var defaultExclude = ["phantom", "app.phantom"]
 var state = { provider: null, address: null, walletName: null, walletIcon: null }
 var discoveredWallets = {}
 var styleInjected = false
 var modalInjected = false
 var modalResolve = null
 var STORAGE_KEY = "epixkit_wallet"

 function saveWalletPref(info) {
  try { localStorage.setItem(STORAGE_KEY, info.rdns || info.uuid || info.name) } catch (e) {}
 }

 function loadWalletPref() {
  try { return localStorage.getItem(STORAGE_KEY) } catch (e) { return null }
 }

 function clearWalletPref() {
  try { localStorage.removeItem(STORAGE_KEY) } catch (e) {}
 }

 function findSavedWallet(wallets) {
  var pref = loadWalletPref()
  if (!pref) return null
  for (var i = 0; i < wallets.length; i++) {
   var info = wallets[i].info
   if ((info.rdns && info.rdns === pref) || info.uuid === pref || info.name === pref) return wallets[i]
  }
  return null
 }

 // EIP-6963 wallet discovery - start listening immediately
 window.addEventListener("eip6963:announceProvider", function(e) {
  var d = e.detail
  if (d && d.info && d.provider) {
   discoveredWallets[d.info.uuid] = { info: d.info, provider: d.provider }
  }
 })
 window.dispatchEvent(new Event("eip6963:requestProvider"))

 function detectFallbackName(p) {
  if (p.isRabby) return "Rabby"
  if (p.isMetaMask) return "MetaMask"
  if (p.isCoinbaseWallet) return "Coinbase Wallet"
  if (p.isTrust || p.isTrustWallet) return "Trust Wallet"
  if (p.isBraveWallet) return "Brave Wallet"
  if (p.isKeplr) return "Keplr"
  if (p.isLeap) return "Leap"
  return "Browser Wallet"
 }

 function isExcluded(info) {
  var exclude = defaultExclude.concat(config && config.excludeWallets ? config.excludeWallets : [])
  var name = (info.name || "").toLowerCase()
  var rdns = (info.rdns || "").toLowerCase()
  for (var i = 0; i < exclude.length; i++) {
   var ex = exclude[i].toLowerCase()
   if (name.indexOf(ex) !== -1 || rdns.indexOf(ex) !== -1) return true
  }
  return false
 }

 function getWalletListInternal() {
  var list = []
  for (var uuid in discoveredWallets) {
   if (!isExcluded(discoveredWallets[uuid].info)) list.push(discoveredWallets[uuid])
  }
  if (list.length === 0 && window.ethereum) {
   if (window.ethereum.providers && window.ethereum.providers.length > 0) {
    window.ethereum.providers.forEach(function(p, i) {
     var info = { uuid: "_fallback_" + i, name: detectFallbackName(p), icon: null, rdns: null }
     if (!isExcluded(info) && !p.isPhantom) list.push({ info: info, provider: p })
    })
   } else if (!window.ethereum.isPhantom) {
    var info = { uuid: "_fallback", name: detectFallbackName(window.ethereum), icon: null, rdns: null }
    if (!isExcluded(info)) list.push({ info: info, provider: window.ethereum })
   }
  }
  return list
 }

 function escHtml(s) {
  var d = document.createElement("div")
  d.appendChild(document.createTextNode(s))
  return d.innerHTML
 }

 function injectStyle() {
  if (styleInjected) return
  styleInjected = true
  var style = document.createElement("style")
  style.textContent = [
   ".epixkit-overlay {",
   " position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7);",
   " display: flex; align-items: center; justify-content: center; z-index: 10000;",
   "}",
   ".epixkit-box {",
   " background: #161b22; border: 1px solid #30363d; border-radius: 12px;",
   " padding: 24px; max-width: 380px; width: 90%; max-height: 80vh; overflow-y: auto;",
   "}",
   ".epixkit-box h3 { color: #e0e0e0; font-size: 1.1em; margin-bottom: 16px; margin-top: 0; }",
   ".epixkit-item {",
   " display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px;",
   " margin-bottom: 6px; background: #0d1117; border: 1px solid #30363d; color: #e0e0e0;",
   " border-radius: 8px; cursor: pointer; font-size: 0.95em; font-weight: 500;",
   " font-family: inherit; transition: border-color 0.15s, background 0.15s;",
   " box-sizing: border-box;",
   "}",
   ".epixkit-item:hover { border-color: #58a6ff; background: #1a2332; }",
   ".epixkit-item img { width: 32px; height: 32px; border-radius: 6px; }",
   ".epixkit-close {",
   " float: right; background: none; border: none; color: #484f58; font-size: 1.4em;",
   " cursor: pointer; margin: 0; padding: 0; line-height: 1;",
   "}",
   ".epixkit-close:hover { color: #e0e0e0; }",
   ".epixkit-connecting {",
   " display: flex; align-items: center; gap: 12px; padding: 20px 0; justify-content: center;",
   " color: #8b949e; font-size: 0.9em;",
   "}",
   ".epixkit-spinner {",
   " width: 20px; height: 20px; border: 2px solid #30363d; border-top-color: #58a6ff;",
   " border-radius: 50%; animation: epixkit-spin 0.8s linear infinite;",
   "}",
   "@keyframes epixkit-spin { to { transform: rotate(360deg); } }",
   ".epixkit-empty a { color: #58a6ff; text-decoration: none; }",
   ".epixkit-empty a:hover { text-decoration: underline; }"
  ].join("\n")
  document.head.appendChild(style)
 }

 function injectModal() {
  if (modalInjected) return
  modalInjected = true
  var modal = document.createElement("div")
  modal.id = "epixkit-modal"
  modal.style.display = "none"
  modal.innerHTML = [
   '<div class="epixkit-overlay">',
   ' <div class="epixkit-box">',
   '  <button class="epixkit-close">&times;</button>',
   '  <h3>Connect Wallet</h3>',
   '  <div id="epixkit-list"></div>',
   '  <div id="epixkit-empty" class="epixkit-empty" style="display:none;color:#8b949e;font-size:0.85em;text-align:center;padding:20px 0;">',
   '   No wallets detected.<br>Install ',
   '   <a href="https://metamask.io/download/" target="_blank">MetaMask</a>, ',
   '   <a href="https://rabby.io/" target="_blank">Rabby</a>, ',
   '   <a href="https://www.keplr.app/get" target="_blank">Keplr</a>, or another EVM wallet.',
   '  </div>',
   ' </div>',
   '</div>'
  ].join("")

  // Close on overlay click
  modal.querySelector(".epixkit-overlay").addEventListener("click", function(e) {
   if (e.target === this) closeModal()
  })
  // Close button
  modal.querySelector(".epixkit-close").addEventListener("click", closeModal)
  // Stop propagation on box
  modal.querySelector(".epixkit-box").addEventListener("click", function(e) {
   e.stopPropagation()
  })

  document.body.appendChild(modal)
 }

 function showModal(wallets) {
  injectStyle()
  injectModal()

  var list = document.getElementById("epixkit-list")
  var empty = document.getElementById("epixkit-empty")
  list.innerHTML = ""

  if (wallets.length === 0) {
   empty.style.display = "block"
   document.getElementById("epixkit-modal").style.display = "block"
   return new Promise(function(resolve) { modalResolve = resolve })
  }

  empty.style.display = "none"
  wallets.forEach(function(w) {
   var btn = document.createElement("button")
   btn.className = "epixkit-item"
   if (w.info.icon) {
    var img = document.createElement("img")
    img.src = w.info.icon
    img.alt = w.info.name
    btn.appendChild(img)
   } else {
    var placeholder = document.createElement("div")
    placeholder.style.cssText = "width:32px;height:32px;border-radius:6px;background:#30363d;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:1.2em;flex-shrink:0;"
    placeholder.textContent = w.info.name.charAt(0)
    btn.appendChild(placeholder)
   }
   var name = document.createElement("span")
   name.textContent = w.info.name
   btn.appendChild(name)
   btn.onclick = function() {
    var resolve = modalResolve
    modalResolve = null
    if (resolve) resolve(w)
   }
   list.appendChild(btn)
  })

  document.getElementById("epixkit-modal").style.display = "block"
  return new Promise(function(resolve) { modalResolve = resolve })
 }

 function showConnecting(name) {
  injectStyle()
  injectModal()
  var list = document.getElementById("epixkit-list")
  var empty = document.getElementById("epixkit-empty")
  empty.style.display = "none"
  list.innerHTML = '<div class="epixkit-connecting"><div class="epixkit-spinner"></div>Connecting to ' + escHtml(name) + '...</div>'
  document.getElementById("epixkit-modal").style.display = "block"
 }

 function showError(msg) {
  var list = document.getElementById("epixkit-list")
  list.innerHTML = '<div style="color:#f85149;font-size:0.85em;text-align:center;padding:12px 0;">' + escHtml(msg) + '</div>'
 }

 function closeModal() {
  var modal = document.getElementById("epixkit-modal")
  if (modal) modal.style.display = "none"
  if (modalResolve) { modalResolve(null); modalResolve = null }
 }

 async function switchChain(provider) {
  if (!config || !config.chainId) return
  try {
   await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainId }] })
  } catch (err) {
   if (err.code === 4902) {
    var params = { chainId: config.chainId }
    if (config.chainName) params.chainName = config.chainName
    if (config.rpcUrls) params.rpcUrls = config.rpcUrls
    if (config.blockExplorerUrls) params.blockExplorerUrls = config.blockExplorerUrls
    if (config.nativeCurrency) params.nativeCurrency = config.nativeCurrency
    await provider.request({ method: "wallet_addEthereumChain", params: [params] })
   } else {
    throw err
   }
  }
 }

 // Public API
 window.EpixKit = {
  init: function(cfg) {
   config = cfg || {}
   if (config.onReconnect) {
    var cb = config.onReconnect
    ;(async function() {
     try {
      var result = await window.EpixKit.reconnect()
      if (result) cb(result)
     } catch (err) {}
    })()
   }
  },

  connect: async function() {
   // Re-request providers in case wallets loaded after page init
   window.dispatchEvent(new Event("eip6963:requestProvider"))

   // Small delay to let late wallets announce
   await new Promise(function(r) { setTimeout(r, 50) })

   var wallets = getWalletListInternal()

   var selected
   if (wallets.length === 0) {
    // Show modal with install links, then reject when closed
    await showModal(wallets)
    return Promise.reject(new Error("No wallet detected"))
   }

   // Try to reconnect to previously used wallet
   selected = findSavedWallet(wallets)

   if (!selected) {
    if (wallets.length === 1) {
     selected = wallets[0]
    } else {
     selected = await showModal(wallets)
     if (!selected) return Promise.reject(new Error("User cancelled"))
    }
   }

   showConnecting(selected.info.name)

   try {
    var raw = selected.provider

    // Request accounts
    await raw.request({ method: "eth_requestAccounts" })

    // Switch chain
    await switchChain(raw)

    // Get the connected address
    var accounts = await raw.request({ method: "eth_accounts" })
    var address = accounts[0]

    // Store state + remember wallet choice
    state.provider = raw
    state.address = address
    state.walletName = selected.info.name
    state.walletIcon = selected.info.icon
    saveWalletPref(selected.info)

    // Close modal
    var modal = document.getElementById("epixkit-modal")
    if (modal) modal.style.display = "none"

    return {
     provider: raw,
     address: address,
     walletName: selected.info.name,
     walletIcon: selected.info.icon
    }
   } catch (err) {
    showError(err.message || "Connection failed")
    setTimeout(function() {
     var modal = document.getElementById("epixkit-modal")
     if (modal) modal.style.display = "none"
    }, 3000)
    throw err
   }
  },

  reconnect: async function() {
   var pref = loadWalletPref()
   if (!pref) return null

   window.dispatchEvent(new Event("eip6963:requestProvider"))
   await new Promise(function(r) { setTimeout(r, 50) })

   var wallets = getWalletListInternal()
   var saved = findSavedWallet(wallets)
   if (!saved) return null

   try {
    var raw = saved.provider
    // Silent check - no popup, just see if already authorized
    var accounts = await raw.request({ method: "eth_accounts" })
    if (!accounts || accounts.length === 0) return null

    await switchChain(raw)

    state.provider = raw
    state.address = accounts[0]
    state.walletName = saved.info.name
    state.walletIcon = saved.info.icon

    return {
     provider: raw,
     address: accounts[0],
     walletName: saved.info.name,
     walletIcon: saved.info.icon
    }
   } catch (err) {
    return null
   }
  },

  disconnect: function() {
   state.provider = null
   state.address = null
   state.walletName = null
   state.walletIcon = null
   clearWalletPref()
  },

  isConnected: function() {
   return !!(state.provider && state.address)
  },

  getAddress: function() {
   return state.address
  },

  getProvider: function() {
   return state.provider
  },

  getWalletName: function() {
   return state.walletName
  },

  getWallets: function() {
   window.dispatchEvent(new Event("eip6963:requestProvider"))
   return getWalletListInternal()
  }
 }
})()
