const { createApp, ref, reactive, computed, onMounted } = Vue

const ICONS = {
  logo:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  caret:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  plus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  k8s:     `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="22" y2="12"/></svg>`,
  arrow:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  console: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  copy:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  server:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  terminal:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
}

createApp({
  template: /* html */ `
  <div class="layout">

    <!-- ══ Sidebar ══════════════════════════════════════════════════════════ -->
    <aside class="sidebar">
      <div class="s-logo">
        <span class="s-logo-icon" v-html="icons.logo"></span>
        <span class="s-logo-name">aws-switch</span>
        <span class="s-logo-badge">beta</span>
      </div>

      <div class="s-scroll">
        <p class="s-label">Connections</p>

        <!-- SSO groups -->
        <div class="conn" v-for="g in groups" :key="g.startUrl">
          <div class="conn-hd" @click="toggleGroup(g.startUrl)">
            <span class="sdot" :class="dotClass(g.startUrl)"></span>
            <span class="conn-label" :title="g.startUrl">{{ shortUrl(g.startUrl) }}</span>
            <span class="caret" :class="{ open: expanded.groups[g.startUrl] }" v-html="icons.caret"></span>
          </div>

          <div class="conn-body" v-show="expanded.groups[g.startUrl]">
            <div class="login-pending" v-if="loginState[g.startUrl]">
              <span class="spinner-sm"></span>
              <span>{{ loginState[g.startUrl] }}</span>
            </div>

            <button class="btn-connect" v-else-if="!accounts[g.startUrl]"
              @click.stop="startLogin(g)">
              Connect via Browser
            </button>

            <template v-else>
              <div class="account" v-for="a in accounts[g.startUrl]" :key="a.accountId">
                <div class="account-hd" @click="toggleAccount(a.accountId)">
                  <span class="caret" :class="{ open: expanded.accounts[a.accountId] }" v-html="icons.caret"></span>
                  <span class="account-name" :title="a.accountName">{{ a.accountName || a.accountId }}</span>
                  <span class="account-id">{{ a.accountId.slice(-6) }}</span>
                </div>
                <div class="roles" v-show="expanded.accounts[a.accountId]">
                  <div class="role-row"
                    v-for="r in a.roles" :key="r.roleName"
                    :class="{ active: isActive(a.accountId, r.roleName), assuming: isAssuming(a.accountId, r.roleName) }"
                    @click="assumeRole(g, a, r)">
                    <span class="role-icon">
                      <span class="spinner-sm" v-if="isAssuming(a.accountId, r.roleName)"></span>
                      <span class="ri-on"   v-else-if="isActive(a.accountId, r.roleName)"></span>
                      <span class="ri-ring" v-else></span>
                    </span>
                    <span class="role-name">{{ r.roleName }}</span>
                  </div>
                  <div style="padding:5px 10px;font-size:11px;color:var(--text-3)" v-if="!a.roles.length">
                    No roles available
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Add connection ─────────────────────────────────────────── -->
        <div class="add-conn">
          <div class="add-hd" @click="showAdd = !showAdd">
            <span class="add-plus" v-html="icons.plus"></span>
            <span class="add-lbl">Add connection</span>
          </div>
          <div class="add-form" v-if="showAdd">
            <div class="form-grp">
              <label class="form-lbl">Start URL</label>
              <input class="form-inp" v-model="newSso.url" type="text"
                placeholder="https://company.awsapps.com/start"
                spellcheck="false" autocomplete="off"
                @keydown.enter="$refs.regionRef.focus()" />
            </div>
            <div class="form-grp">
              <label class="form-lbl">SSO Region</label>
              <input class="form-inp" v-model="newSso.region" type="text"
                ref="regionRef" @keydown.enter="connectNew" />
            </div>
            <button class="btn-connect"
              @click="connectNew"
              :disabled="!!loginState[newSso.url.trim()]">
              <template v-if="loginState[newSso.url.trim()]">
                <span class="spinner-sm"></span>&nbsp;{{ loginState[newSso.url.trim()] }}
              </template>
              <template v-else>Connect via Browser</template>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ══ Main ══════════════════════════════════════════════════════════════ -->
    <main class="main">

      <!-- Topbar -->
      <header class="topbar">
        <div class="active-pill" v-if="activeRole">
          <span class="a-dot"></span>
          <span class="a-account">{{ activeRole.accountName }}</span>
          <span class="a-sep">/</span>
          <span class="a-role">{{ activeRole.roleName }}</span>
          <span class="a-region">{{ activeRole.region }}</span>
          <span class="a-expiry" v-if="expiryDisplay">{{ expiryDisplay }}</span>
        </div>
        <span class="topbar-idle" v-else>Select a role to get started</span>

        <!-- Action buttons (only when a role is active) -->
        <template v-if="activeRole">
          <button class="btn-icon" @click="openWebConsole" :disabled="openingConsole"
            title="Open AWS Management Console in browser">
            <span class="spinner-sm" v-if="openingConsole"></span>
            <span v-else v-html="icons.console"></span>
          </button>
          <button class="btn-icon" @click="copyCredentials"
            title="Copy credentials as shell export statements">
            <span v-html="icons.copy"></span>
          </button>
        </template>

        <button class="btn-icon" :class="{ spinning: refreshing }" @click="refresh" title="Refresh">
          <span v-html="icons.refresh"></span>
        </button>
      </header>

      <!-- Content -->
      <div class="content">

        <!-- Welcome -->
        <div class="welcome" v-if="!activeRole">
          <div class="welcome-graphic" v-html="icons.k8s"></div>
          <h2>No role selected</h2>
          <p>Connect an AWS SSO provider from the sidebar, then click any role to assume it.</p>
          <div class="welcome-hint">
            <span v-html="icons.arrow"></span>
            <span>Add a connection from the sidebar to get started</span>
          </div>
        </div>

        <!-- Tabs + content -->
        <template v-else>
          <!-- Tab bar -->
          <div class="tab-bar">
            <button class="tab" :class="{ active: activeTab === 'eks' }" @click="switchTab('eks')">
              <span v-html="icons.k8s" style="width:13px;height:13px;opacity:.7"></span>
              EKS Clusters
              <span class="tab-badge" v-if="!eksLoading && eksClusters.length">{{ eksClusters.length }}</span>
            </button>
            <button class="tab" :class="{ active: activeTab === 'ec2' }" @click="switchTab('ec2')">
              <span v-html="icons.server" style="opacity:.7"></span>
              EC2 Instances
              <span class="tab-badge" v-if="!ec2Loading && ec2Instances.length">{{ ec2Instances.length }}</span>
            </button>
          </div>

          <!-- ── EKS tab ────────────────────────────────────────────────── -->
          <div v-if="activeTab === 'eks'">
            <div class="sec-hd">
              <h2>EKS Clusters</h2>
              <span class="sec-region">{{ activeRole.region }}</span>
            </div>

            <div class="skeleton-grid" v-if="eksLoading">
              <div class="skel-card" v-for="i in 3" :key="i"></div>
            </div>

            <div class="no-clusters" v-else-if="eksClusters.length === 0">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".4"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>
              <p>No EKS clusters found in <strong>{{ activeRole.region }}</strong></p>
            </div>

            <div class="clusters-grid" v-else>
              <div class="c-card"
                v-for="c in eksClusters" :key="c.name"
                :class="{ done: isConfigured(c) }">
                <div class="c-top">
                  <span class="c-sdot" :class="c.status.toLowerCase()"></span>
                  <span class="c-name" :title="c.name">{{ c.name }}</span>
                  <span class="c-ver">k8s {{ c.version }}</span>
                </div>
                <div class="c-meta">
                  <span class="c-region-txt">{{ c.region }}</span>
                  <span class="c-badge" :class="c.status.toLowerCase()">{{ c.status }}</span>
                </div>
                <div class="c-divider"></div>
                <div class="c-foot">
                  <button class="btn-done" v-if="isConfigured(c)" disabled>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    kubectl configured
                  </button>
                  <button class="btn-kube" v-else @click="configureKubeconfig(c)">
                    Configure kubectl
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── EC2 tab ────────────────────────────────────────────────── -->
          <div v-if="activeTab === 'ec2'">
            <div class="sec-hd">
              <h2>EC2 Instances</h2>
              <span class="sec-region">{{ activeRole.region }}</span>
            </div>

            <div class="skeleton-grid" v-if="ec2Loading">
              <div class="skel-card" v-for="i in 4" :key="i"></div>
            </div>

            <div class="no-clusters" v-else-if="ec2Instances.length === 0">
              <span v-html="icons.server" style="opacity:.3;transform:scale(2.5);display:block;margin-bottom:8px"></span>
              <p>No EC2 instances found in <strong>{{ activeRole.region }}</strong></p>
              <p style="font-size:11px;margin-top:4px">Only running, stopped, and pending instances are shown.</p>
            </div>

            <div class="clusters-grid" v-else>
              <div class="c-card ec2-card"
                v-for="inst in ec2Instances" :key="inst.instanceId">
                <div class="c-top">
                  <span class="c-sdot" :class="ec2StateClass(inst.state)"></span>
                  <span class="c-name" :title="inst.instanceId">{{ inst.name || inst.instanceId }}</span>
                  <span class="c-ver">{{ inst.instanceType }}</span>
                </div>
                <div class="c-meta">
                  <span class="c-region-txt mono">{{ inst.privateIp || '—' }}</span>
                  <span class="c-badge" :class="ec2StateClass(inst.state)">{{ inst.state }}</span>
                </div>
                <div style="font-size:11px;color:var(--text-3);padding:2px 0">
                  {{ inst.az }} · {{ inst.platform }}
                  <span v-if="inst.publicIp" style="color:var(--accent-text)"> · {{ inst.publicIp }}</span>
                </div>
                <div class="c-divider"></div>
                <div class="c-foot" style="gap:8px">
                  <button class="btn-icon" @click="copySSMCommand(inst)"
                    title="Copy SSM connect command to clipboard">
                    <span v-html="icons.copy"></span>
                  </button>
                  <button class="btn-kube" v-if="inst.state === 'running'"
                    @click="connectSSM(inst)">
                    <span v-html="icons.terminal" style="margin-right:5px"></span>
                    Connect via SSM
                  </button>
                  <span v-else style="font-size:12px;color:var(--text-3);margin-left:auto">
                    {{ inst.state }}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </template>

      </div>
    </main>

    <!-- ══ Toast ════════════════════════════════════════════════════════════ -->
    <div class="toast-wrap">
      <transition name="slide-up">
        <div class="toast" :class="toast.type" v-if="toast.visible">{{ toast.message }}</div>
      </transition>
    </div>

  </div>
  `,

  setup() {
    const icons = ICONS

    // ── State ───────────────────────────────────────────────────────────────
    const groups        = ref([])
    const accounts      = reactive({})
    const expanded      = reactive({ groups: {}, accounts: {} })
    const loginState    = reactive({})
    const loginSessions = reactive({})
    const activeRole    = ref(null)
    const assumingRole  = ref(null)
    const eksClusters   = ref([])
    const eksLoading    = ref(false)
    const ec2Instances  = ref([])
    const ec2Loading    = ref(false)
    const activeTab     = ref('eks')
    const configured    = reactive(new Set())
    const refreshing    = ref(false)
    const openingConsole = ref(false)
    const showAdd       = ref(false)
    const newSso        = reactive({ url: '', region: 'us-east-1' })
    const toast         = reactive({ visible: false, message: '', type: '' })
    let   toastTimer    = null

    // ── Helpers ─────────────────────────────────────────────────────────────
    const shortUrl    = u => u.replace('https://', '').replace(/\/start\/?$/, '')
    const dotClass    = u => loginState[u] ? 'connecting' : accounts[u] ? 'connected' : 'disconnected'
    const isActive    = (id, role) => activeRole.value?.accountId === id && activeRole.value?.roleName === role
    const isAssuming  = (id, role) => assumingRole.value === `${id}/${role}`
    const isConfigured = c => configured.has(c.arn || c.name)
    const ec2StateClass = s => s === 'running' ? 'active' : s === 'stopped' || s === 'terminated' ? 'failed' : 'creating'

    const expiryDisplay = computed(() => {
      if (!activeRole.value?.expiresAt) return ''
      const d = new Date(activeRole.value.expiresAt) - Date.now()
      if (d < 0) return 'expired'
      const m = Math.floor(d / 60000), h = Math.floor(m / 60)
      return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
    })

    function showToast(message, type = 'info') {
      clearTimeout(toastTimer)
      Object.assign(toast, { visible: true, message, type })
      toastTimer = setTimeout(() => { toast.visible = false }, 4000)
    }

    const toggleGroup   = u  => { expanded.groups[u]   = !expanded.groups[u] }
    const toggleAccount = id => { expanded.accounts[id] = !expanded.accounts[id] }

    function getRegion(startUrl) {
      const g = groups.value.find(g => g.startUrl === startUrl)
      return g?.profiles?.[0]?.region || g?.ssoRegion || 'us-east-1'
    }

    // ── Init ────────────────────────────────────────────────────────────────
    async function init() {
      const { ssoGroups } = await window.aws.parseConfig()
      groups.value = ssoGroups
      for (const g of ssoGroups) {
        if (!(g.startUrl in expanded.groups)) expanded.groups[g.startUrl] = true
      }
      await Promise.all(ssoGroups.map(async g => {
        if (!(await window.aws.checkSsoLogin(g.startUrl))) return
        try {
          const accs = await window.aws.listAccounts({ startUrl: g.startUrl, ssoRegion: g.ssoRegion })
          accounts[g.startUrl] = accs
          if (accs?.length) expanded.accounts[accs[0].accountId] = true
        } catch { accounts[g.startUrl] = null }
      }))
      if (!ssoGroups.length) showAdd.value = true
    }

    // ── Login ───────────────────────────────────────────────────────────────
    const startLogin = g => _login(g.startUrl, g.ssoRegion)

    async function connectNew() {
      const url = newSso.url.trim()
      if (!url) { showToast('Enter a Start URL', 'error'); return }
      if (!url.startsWith('http')) { showToast('URL must start with https://', 'error'); return }
      await _login(url, newSso.region || 'us-east-1')
    }

    async function _login(startUrl, ssoRegion) {
      loginState[startUrl] = 'Opening browser…'
      try {
        const session = await window.aws.ssoLoginStart({ startUrl, ssoRegion })
        Object.assign(session, { startUrl, ssoRegion })
        loginSessions[startUrl] = session
        loginState[startUrl] = 'Waiting for approval…'
        _poll(startUrl, ssoRegion, session)
      } catch (e) {
        loginState[startUrl] = null
        showToast(`Login error: ${e}`, 'error')
      }
    }

    function _poll(startUrl, ssoRegion, session) {
      const t = setInterval(async () => {
        const r = await window.aws.ssoLoginPoll(session)
        if (r.success) {
          clearInterval(t)
          try {
            const accs = await window.aws.listAccounts({ startUrl, ssoRegion })
            accounts[startUrl] = accs
            if (accs?.length) { expanded.groups[startUrl] = true; expanded.accounts[accs[0].accountId] = true }
            window.aws.writeSsoConfig({ startUrl, ssoRegion, accounts: accs || [] })
              .then(res => showToast(`${res.profileCount} profiles written to ~/.aws/config`, 'success'))
              .catch(() => {})
            const { ssoGroups } = await window.aws.parseConfig()
            groups.value = ssoGroups
            showAdd.value = false; newSso.url = ''
          } catch (e) { showToast(`Login ok, error loading accounts: ${e}`, 'error') }
          loginState[startUrl] = null
        } else if (!r.pending) {
          clearInterval(t)
          loginState[startUrl] = null
          showToast(`Login failed: ${r.error || 'unknown'}`, 'error')
        }
      }, (session.interval || 5) * 1000)
    }

    // ── Assume role ─────────────────────────────────────────────────────────
    async function assumeRole(g, a, r) {
      const key = `${a.accountId}/${r.roleName}`
      if (assumingRole.value === key) return
      assumingRole.value = key
      try {
        const creds = await window.aws.assumeRole({
          startUrl: g.startUrl, ssoRegion: g.ssoRegion,
          accountId: a.accountId, roleName: r.roleName,
        })
        activeRole.value = {
          ...creds,
          accountName: a.accountName || a.accountId,
          startUrl: g.startUrl,
          region: getRegion(g.startUrl),
        }
        // Reset tabs & secondary data on role switch
        activeTab.value = 'eks'
        ec2Instances.value = []
        showToast(`Assumed ${r.roleName} ✓`, 'success')
        loadEks()
      } catch (e) {
        showToast(`Failed: ${e}`, 'error')
      } finally {
        assumingRole.value = null
      }
    }

    // ── Tab switching ───────────────────────────────────────────────────────
    async function switchTab(tab) {
      activeTab.value = tab
      if (tab === 'ec2' && ec2Instances.value.length === 0 && !ec2Loading.value) {
        await loadEc2()
      }
    }

    // ── EKS ─────────────────────────────────────────────────────────────────
    async function loadEks() {
      if (!activeRole.value) return
      const { accessKeyId, secretAccessKey, sessionToken, region } = activeRole.value
      if (!secretAccessKey) return
      eksLoading.value = true; eksClusters.value = []
      try { eksClusters.value = await window.aws.listEksClusters({ region, accessKeyId, secretAccessKey, sessionToken }) }
      catch { eksClusters.value = [] }
      finally { eksLoading.value = false }
    }

    async function configureKubeconfig(cluster) {
      try {
        const res = await window.aws.updateKubeconfig({ cluster, profileName: activeRole.value.profileName })
        configured.add(cluster.arn || cluster.name)
        eksClusters.value = [...eksClusters.value]
        showToast(`kubectl context → ${res.contextName}`, 'success')
      } catch (e) {
        showToast(`kubeconfig error: ${e}`, 'error')
      }
    }

    // ── EC2 ─────────────────────────────────────────────────────────────────
    async function loadEc2() {
      if (!activeRole.value) return
      const { accessKeyId, secretAccessKey, sessionToken, region } = activeRole.value
      if (!secretAccessKey) return
      ec2Loading.value = true; ec2Instances.value = []
      try { ec2Instances.value = await window.aws.listEc2Instances({ region, accessKeyId, secretAccessKey, sessionToken }) }
      catch { ec2Instances.value = [] }
      finally { ec2Loading.value = false }
    }

    async function connectSSM(instance) {
      try {
        await window.aws.openSsmSession({
          instanceId:  instance.instanceId,
          region:      instance.region,
          profileName: activeRole.value?.profileName,
        })
        showToast(`SSM session opened — check your terminal`, 'success')
      } catch (e) {
        showToast(`SSM error: ${e}`, 'error')
      }
    }

    async function copySSMCommand(instance) {
      const profile = activeRole.value?.profileName
      let cmd = `aws ssm start-session --target ${instance.instanceId} --region ${instance.region}`
      if (profile) cmd += ` --profile ${profile}`
      try {
        await navigator.clipboard.writeText(cmd)
        showToast('SSM command copied', 'success')
      } catch {
        showToast('Clipboard write failed', 'error')
      }
    }

    // ── Web Console ─────────────────────────────────────────────────────────
    async function openWebConsole() {
      if (!activeRole.value || openingConsole.value) return
      openingConsole.value = true
      try {
        await window.aws.openWebConsole({
          accessKeyId:     activeRole.value.accessKeyId,
          secretAccessKey: activeRole.value.secretAccessKey,
          sessionToken:    activeRole.value.sessionToken,
          region:          activeRole.value.region,
        })
        showToast('AWS Console opened in browser', 'success')
      } catch (e) {
        showToast(`Console error: ${e}`, 'error')
      } finally {
        openingConsole.value = false
      }
    }

    // ── Copy credentials ─────────────────────────────────────────────────────
    async function copyCredentials() {
      if (!activeRole.value) return
      const { accessKeyId, secretAccessKey, sessionToken, region } = activeRole.value
      const text = [
        `export AWS_ACCESS_KEY_ID=${accessKeyId}`,
        `export AWS_SECRET_ACCESS_KEY=${secretAccessKey}`,
        `export AWS_SESSION_TOKEN=${sessionToken}`,
        `export AWS_DEFAULT_REGION=${region}`,
      ].join('\n')
      try {
        await navigator.clipboard.writeText(text)
        showToast('Credentials copied (shell export format)', 'success')
      } catch {
        showToast('Clipboard write failed', 'error')
      }
    }

    // ── Refresh ──────────────────────────────────────────────────────────────
    async function refresh() {
      refreshing.value = true
      for (const k of Object.keys(accounts)) delete accounts[k]
      ec2Instances.value = []
      await init()
      if (activeRole.value) {
        await loadEks()
        if (activeTab.value === 'ec2') await loadEc2()
      }
      refreshing.value = false
    }

    setInterval(() => { if (activeRole.value?.expiresAt) activeRole.value = { ...activeRole.value } }, 30000)
    onMounted(init)

    return {
      icons, groups, accounts, expanded, loginState, activeRole, assumingRole,
      eksClusters, eksLoading, ec2Instances, ec2Loading, activeTab,
      refreshing, openingConsole, showAdd, newSso, toast, expiryDisplay,
      toggleGroup, toggleAccount, shortUrl, dotClass,
      isActive, isAssuming, isConfigured, ec2StateClass,
      startLogin, connectNew, assumeRole, switchTab,
      configureKubeconfig, connectSSM, copySSMCommand,
      openWebConsole, copyCredentials, refresh,
    }
  },
}).mount('#app')
