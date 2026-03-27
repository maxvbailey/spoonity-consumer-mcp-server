/**
 * Spoonity Consumer API Client
 *
 * Server-side HTTP client for the Spoonity REST API.
 * Mirrors all consumer endpoints from the sample app's api.ts.
 */

export interface SpoonityConfig {
  baseUrl: string;
  sessionKey: string;
  vendorId: string;
}

export class SpoonityClient {
  private baseUrl: string;
  private sessionKey: string;
  private vendorId: string;

  constructor(config: SpoonityConfig) {
    this.baseUrl = config.baseUrl;
    this.sessionKey = config.sessionKey;
    this.vendorId = config.vendorId;
  }

  // ── HTTP helpers ────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) throw new Error(`API ${method} ${path} failed (${res.status}): ${res.statusText}`);
      return {} as T;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(`API ${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
    return data;
  }

  private get<T>(path: string) { return this.request<T>('GET', path); }
  private post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  private put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  private del<T>(path: string, body?: unknown) {
    return this.request<T>('DELETE', path, body);
  }

  private sk(path: string, extra = '') {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}session_key=${this.sessionKey}${extra}`;
  }

  /** Update session key (e.g. after login) */
  setSessionKey(key: string) { this.sessionKey = key; }

  /** Get current session key */
  getSessionKey(): string { return this.sessionKey; }

  // ── Auth ──────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const result = await this.post<any>('/user/authenticate', {
      email_address: email,
      password,
      vendor: this.vendorId,
    });
    if (result?.session_identifier) {
      this.sessionKey = result.session_identifier;
    }
    return result;
  }

  async register(params: {
    email_address: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    terms: boolean;
  }) {
    return this.post<any>('/user/register', {
      ...params,
      vendor: this.vendorId,
      language: 1,
      contact_consent: true,
    });
  }

  async checkEmailExists(email: string) {
    return this.get<any>(`/user/email/exists?email=${encodeURIComponent(email)}&vendor=${this.vendorId}`);
  }

  async logout() {
    if (!this.sessionKey) return {};
    const result = await this.get<any>(`/user/logout?session_key=${this.sessionKey}`);
    this.sessionKey = '';
    return result;
  }

  // ── Profile ───────────────────────────────────────────────────────

  async getProfile() {
    return this.get<any>(this.sk('/user/profile'));
  }

  async updateProfile(body: Record<string, unknown>) {
    return this.put<any>(this.sk('/user/profile'), body);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.put<any>(this.sk('/user/password'), {
      current_password: currentPassword,
      password: newPassword,
    });
  }

  // ── Balances & Loyalty ────────────────────────────────────────────

  async getQuickPayBalance() {
    return this.get<any>(this.sk('/user/quick-pay/balance'));
  }

  async getCurrencyBalance() {
    return this.get<any>(this.sk('/user/currency/balance'));
  }

  async getBarcode() {
    return this.post<any>(this.sk('/user/token/request'), {
      token_type: 2,
      style: 'QR CODE',
    });
  }

  async getRewards() {
    return this.get<any>(this.sk('/user/reward/list'));
  }

  async getCoupons(page = 1, limit = 20) {
    return this.get<any>(this.sk('/user/reward/list', `&page=${page}&limit=${limit}`));
  }

  // ── Transactions ──────────────────────────────────────────────────

  async getTransactions(page = 1, limit = 20) {
    return this.get<any>(this.sk('/user/transaction/list', `&order=dateCreated(desc)&page=${page}&limit=${limit}`));
  }

  async rateTransaction(transactionId: number, rating: number, comment = '') {
    return this.post<any>(this.sk('/user/transaction/rate'), {
      transaction: transactionId,
      rating,
      comment,
    });
  }

  async tipTransaction(transactionId: number, amount: number) {
    return this.post<any>(this.sk('/user/transaction/tip'), {
      transaction: transactionId,
      amount,
    });
  }

  // ── Stores ────────────────────────────────────────────────────────

  async getStores(lat = 47.2529, lng = -122.4552, distance = 50000, unit = 'KM', page = 1, limit = 50) {
    return this.get<any>(
      `/vendor/store/list?vendor=${this.vendorId}&latitude=${lat}&longitude=${lng}&distance=${distance}&unit=${unit}&page=${page}&limit=${limit}`
    );
  }

  // ── Cards ─────────────────────────────────────────────────────────

  async getCardsWithPin() {
    return this.get<any>(this.sk('/user/card/list'));
  }

  async getCards3rdParty() {
    return this.get<any>(this.sk('/user/card-3rdparty/list'));
  }

  async addCard(number: string, pin: string) {
    return this.post<any>(this.sk('/user/card/add'), { number, pin });
  }

  async removeCard(cardId: number) {
    return this.del<any>(this.sk('/user/card'), { user_card: { id: cardId } });
  }

  // ── Credit Cards & Reload ─────────────────────────────────────────

  async getCreditCards() {
    return this.get<any>(this.sk('/user/billing-profile/list'));
  }

  async reloadBalance(amount: number, billingProfileId: number) {
    return this.post<any>(this.sk('/user/billing-profile/reload'), {
      amount,
      user_billingprofile: billingProfileId,
    });
  }

  async getAutoReloadSettings() {
    return this.get<any>(this.sk('/user/reload/settings'));
  }

  // ── Messages ──────────────────────────────────────────────────────

  async getMessages() {
    return this.get<any>(this.sk('/user/message/list'));
  }

  async markMessageRead(messageId: number) {
    return this.put<any>(this.sk('/user/message'), {
      user_message: messageId,
      read: true,
      status_id: 1,
    });
  }

  // ── E-Gift ────────────────────────────────────────────────────────

  async sendEgift(params: {
    amount: number;
    recipient_name: string;
    recipient_email: string;
    buyer_name: string;
    buyer_email: string;
    message?: string;
    send_date?: string;
    billing_profile_id?: number;
  }) {
    return this.post<any>(this.sk(`/vendor/${this.vendorId}/egift`), {
      amount: params.amount,
      recipient: { name: params.recipient_name, email: params.recipient_email },
      buyer: { name: params.buyer_name, email: params.buyer_email },
      message: params.message || '',
      send_date: params.send_date || '',
      billing: params.billing_profile_id ? { id: params.billing_profile_id } : undefined,
      vendor: parseInt(this.vendorId, 10),
    });
  }

  // ── Content ───────────────────────────────────────────────────────

  async getTermsOfService() {
    return this.get<any>(`/vendor/content/terms-of-service?vendor=${this.vendorId}`);
  }

  async getPrivacyPolicy() {
    return this.get<any>(`/vendor/content/privacy-policy?vendor=${this.vendorId}`);
  }

  async getFaq() {
    return this.get<any>(`/vendor/content/faq?vendor=${this.vendorId}`);
  }

  // ── Notifications ─────────────────────────────────────────────────

  async getNotificationPrefs() {
    return this.get<any>(this.sk('/user/contact-preference/list'));
  }

  async updateNotificationPrefs(params: Record<string, unknown>) {
    return this.put<any>(this.sk('/user/contact-preference'), params);
  }

  // ── Promotions ────────────────────────────────────────────────────

  async activatePromotion(code: string) {
    return this.post<any>(this.sk('/vendor/promotion/award'), { code });
  }

  // ── Password Reset ────────────────────────────────────────────────

  async requestPasswordReset(email: string) {
    return this.post<any>('/user/password-reset/reset', {
      email_address: email,
      vendor: this.vendorId,
    });
  }

  // ── Guest Balance Check ───────────────────────────────────────────

  async checkCardBalance(number: string, pin: string) {
    return this.get<any>(`/card/balance?number=${encodeURIComponent(number)}&pin=${encodeURIComponent(pin)}&vendor=${this.vendorId}`);
  }

  async checkCard3rdPartyBalance(number: string, pin: string) {
    return this.get<any>(`/card-3rdparty/balance?number=${encodeURIComponent(number)}&pin=${encodeURIComponent(pin)}&vendor=${this.vendorId}`);
  }

  // ── Account Deletion ──────────────────────────────────────────────

  async deleteAccount(password: string) {
    return this.post<any>(this.sk('/user/account/deactivate'), { password });
  }

  // ── Wallet Passes ─────────────────────────────────────────────────

  getAppleWalletPassUrl(userId: string | number): string {
    return `${this.baseUrl}/vendor/${this.vendorId}/passbook/card/export/${userId}?session_key=${this.sessionKey}`;
  }

  getGoogleWalletPassUrl(userId: string | number, passId = 1): string {
    return `${this.baseUrl}/vendor/${this.vendorId}/googlepaypass/${passId}/export/${userId}?session_key=${this.sessionKey}`;
  }
}
