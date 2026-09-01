/**
 * Valqora Modular AI Provider Abstraction
 *
 * Provides a pluggable, provider-agnostic interface for executing AI recovery
 * investigations. Supports Mock/Local Development (default), Gemini, and OpenAI/Compatible
 * endpoints without hard-coding credentials or dependencies.
 */

const { validateAiDecision } = require('./aiContract');

/**
 * Base AI Provider Interface
 */
class BaseAiProvider {
  /**
   * Generates a structured decision object given a prompt and investigation context.
   *
   * @param {string} prompt - Formatted investigation prompt
   * @param {Object} context - Compact investigation context
   * @returns {Promise<Object>} Raw or parsed decision object
   */
  async generateDecision(prompt, context) {
    throw new Error('generateDecision() must be implemented by subclass');
  }
}

/**
 * Mock / Development AI Provider
 *
 * Generates deterministic, high-quality advisory decisions based on the
 * investigation context. Useful for local development, CI/CD, and offline testing.
 */
class MockAiProvider extends BaseAiProvider {
  async generateDecision(prompt, context) {
    const { amount, customer, failure, provider, mlPrediction } = context;
    const reason = failure?.reason || 'UNKNOWN';
    const retryCount = failure?.retryCount ?? 0;
    const customerType = customer?.customerType || 'REGULAR';
    const clv = customer?.customerLifetimeValue || 0;
    const prevFailures = customer?.previousFailures ?? 0;

    let rootCause = 'Unspecified transaction failure';
    let recoverability = 'MEDIUM';
    let recommendedAction = 'PAYMENT_LINK';
    let confidence = 0.85;
    let expectedRecovery = Number(amount);
    let reasoning = [];
    let riskFactors = [];
    let requiresHumanReview = false;

    if (reason === 'SUSPICIOUS_TRANSACTION') {
      rootCause = 'Security anomaly / anomalous transaction pattern detected';
      recoverability = 'LOW';
      recommendedAction = 'HUMAN_REVIEW';
      confidence = 0.95;
      expectedRecovery = 0;
      requiresHumanReview = true;
      reasoning = [
        'Transaction triggered security filters for suspicious velocity or pattern anomalies',
        'Mandatory manual fraud/compliance investigation required before any recovery attempt',
      ];
      riskFactors = [
        'Potential unauthorized card usage or synthetic identity fraud',
        'Automated retry would increase chargeback liability',
      ];
      if (mlPrediction && mlPrediction.isAvailable && typeof mlPrediction.recoveryProbability === 'number') {
        reasoning.push(
          `Supervised recovery model output (${(mlPrediction.recoveryProbability * 100).toFixed(1)}%) is superseded by fraud risk override`
        );
      }
    } else if (reason === 'BANK_TIMEOUT' || reason === 'PROVIDER_TIMEOUT' || reason === 'NETWORK_ERROR') {
      rootCause = `Transient infrastructure failure (${reason}) on ${provider?.name || 'payment gateway'}`;
      recoverability = 'HIGH';
      confidence = retryCount === 0 ? 0.92 : 0.82;
      expectedRecovery = Number(amount);

      if (retryCount < 2) {
        recommendedAction = 'RETRY';
        reasoning = [
          'Failure is transient and network/timeout related rather than account-specific',
          `Transaction has only ${retryCount} retries, well within safe retry thresholds`,
        ];
        if (provider?.currentSuccessRate && provider?.baselineSuccessRate && provider.currentSuccessRate < provider.baselineSuccessRate - 5) {
          reasoning.push(
            `Provider ${provider.name} is experiencing temporary degradation (${provider.currentSuccessRate}% vs ${provider.baselineSuccessRate}% baseline)`
          );
        }
      } else {
        recommendedAction = customerType === 'HIGH_VALUE' ? 'PAYMENT_LINK' : 'WAIT';
        confidence = 0.78;
        reasoning = [
          `Transaction has reached ${retryCount} retries; automated retries stopped to prevent gateway fatigue`,
          customerType === 'HIGH_VALUE'
            ? 'High-value customer: dispatching personalized tokenized payment link directly'
            : 'Cooling-off wait period recommended before customer-facing follow-up',
        ];
        riskFactors.push('Exhausted automated retries; customer intervention needed');
      }

      if (mlPrediction && mlPrediction.isAvailable && typeof mlPrediction.recoveryProbability === 'number') {
        reasoning.push(
          `Statistical recovery probability of ${(mlPrediction.recoveryProbability * 100).toFixed(1)}% confirms high recovery viability`
        );
      }

      if (prevFailures >= 3) {
        riskFactors.push(`Customer has elevated historical failure rate (${prevFailures} prior failures)`);
      }
    } else if (reason === 'CARD_EXPIRED' || reason === 'PAYMENT_METHOD_EXPIRED' || reason === 'INVALID_CARD') {
      rootCause = 'Stored payment credential invalidity or expiration';
      recoverability = customerType === 'HIGH_VALUE' || clv > 25000 ? 'HIGH' : 'MEDIUM';
      recommendedAction = 'PAYMENT_METHOD_UPDATE';
      confidence = 0.88;
      expectedRecovery = Number(amount);
      reasoning = [
        'Payment failed due to invalid or expired card/instrument credentials',
        'Customer prompt to update payment method has highest recovery conversion probability',
      ];
      riskFactors = [
        'Customer friction during credential update may lead to checkout abandonment',
      ];
    } else if (reason === 'INSUFFICIENT_FUNDS') {
      rootCause = 'Customer account balance insufficient at time of transaction';
      const day = new Date(context.timestamp || Date.now()).getUTCDate();
      const isSalaryWindow = day >= 28 || day <= 5;

      recoverability = 'MEDIUM';
      confidence = 0.75;
      expectedRecovery = Number(amount);

      if (isSalaryWindow) {
        recommendedAction = 'WAIT';
        reasoning = [
          'Failure due to insufficient funds occurring during salary/month-end processing cycle',
          'Waiting 24-48 hours for payroll credit yields higher settlement probability',
        ];
      } else {
        recommendedAction = 'PAYMENT_LINK';
        reasoning = [
          'Failure due to insufficient funds outside typical payroll replenishment cycle',
          'Tokenized payment link gives customer flexibility to complete payment via alternate method',
        ];
      }
      riskFactors = ['Customer funds may remain unavailable without alternative payment source'];
    } else if (reason === 'RECURRING_PAYMENT_FAILED') {
      rootCause = 'Standing instruction / recurring mandate execution failure';
      recoverability = 'MEDIUM';
      if (customerType === 'HIGH_VALUE' && prevFailures <= 1) {
        recommendedAction = 'PAYMENT_LINK';
        confidence = 0.86;
        reasoning = [
          'High-value subscription mandate failure with strong customer payment track record',
          'Instant payment link prevents involuntary churn while mandate is refreshed',
        ];
      } else {
        recommendedAction = 'PAYMENT_METHOD_UPDATE';
        confidence = 0.82;
        reasoning = [
          'Recurring billing mandate rejected by issuer bank',
          'Customer must re-authenticate or replace card/mandate details',
        ];
      }
      expectedRecovery = Number(amount);
    } else {
      rootCause = `Unclassified failure (${reason})`;
      recoverability = 'MEDIUM';
      recommendedAction = 'PAYMENT_LINK';
      confidence = 0.70;
      expectedRecovery = Number(amount);
      reasoning = ['Standard payment recovery link dispatched for general transaction decline'];
    }

    return {
      rootCause,
      recoverability,
      recommendedAction,
      confidence,
      expectedRecovery,
      reasoning,
      riskFactors,
      requiresHumanReview,
    };
  }
}

/**
 * Google Gemini AI Provider (via native fetch)
 */
class GeminiAiProvider extends BaseAiProvider {
  constructor(apiKey, modelName = 'gemini-1.5-flash') {
    super();
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateDecision(prompt, context) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini API returned an empty or invalid response');
    }

    return JSON.parse(rawText);
  }
}

/**
 * OpenAI / Open-Source Compatible AI Provider (via native fetch)
 */
class OpenAiProvider extends BaseAiProvider {
  constructor(apiKey, baseUrl = 'https://api.openai.com/v1', modelName = 'gpt-4o-mini') {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.modelName = modelName;
  }

  async generateDecision(prompt, context) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY / LLM_API_KEY is not configured');
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are Valqora AI Investigation Engine. Analyze transaction recovery opportunities and output strictly valid JSON matching the schema.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI-compatible API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error('OpenAI-compatible API returned empty response content');
    }

    return JSON.parse(rawText);
  }
}

/**
 * Factory function to retrieve the configured AI Provider.
 * Defaults safely to MockAiProvider if no external credentials exist.
 *
 * @returns {BaseAiProvider} Configured provider instance
 */
function getAiProvider() {
  const providerType = (process.env.AI_PROVIDER || 'mock').toLowerCase().trim();

  if (providerType === 'gemini' && process.env.GEMINI_API_KEY) {
    return new GeminiAiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-1.5-flash');
  }

  if ((providerType === 'openai' || providerType === 'generic') && (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY)) {
    const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    const url = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    return new OpenAiProvider(key, url, model);
  }

  // Safe default
  return new MockAiProvider();
}

module.exports = {
  BaseAiProvider,
  MockAiProvider,
  GeminiAiProvider,
  OpenAiProvider,
  getAiProvider,
};
