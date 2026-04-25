import axios from 'axios';
import { logger } from './logger.js';

export enum AlertLevel {
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL'
}

export class AlertService {
    private readonly discordWebhook: string | undefined;
    private readonly telegramBotToken: string | undefined;
    private readonly telegramChatId: string | undefined;

    constructor() {
        this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
    }

    /** Send an alert to configured external services (Discord/Telegram) */
    public async sendAlert(title: string, message: string, level: AlertLevel = AlertLevel.INFO): Promise<void> {
        const discordPromise = this.sendDiscord(title, message, level);
        const telegramPromise = this.sendTelegram(title, message, level);
        
        await Promise.allSettled([discordPromise, telegramPromise]);
    }

    private async sendDiscord(title: string, message: string, level: AlertLevel): Promise<void> {
        if (!this.discordWebhook) return;
        
        const colors = {
            [AlertLevel.INFO]: 3447003,      // Blue
            [AlertLevel.SUCCESS]: 3066993,   // Green
            [AlertLevel.WARNING]: 16776960,  // Yellow
            [AlertLevel.CRITICAL]: 16711680  // Red
        };

        try {
            await axios.post(this.discordWebhook, {
                embeds: [{
                    title: `[${level}] ${title}`,
                    description: message,
                    color: colors[level],
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (e: any) {
            logger.error(`[AlertService] Failed to send Discord alert: ${e.message}`);
        }
    }

    private async sendTelegram(title: string, message: string, level: AlertLevel): Promise<void> {
        if (!this.telegramBotToken || !this.telegramChatId) return;

        const text = `*[${level}] ${title}*\n${message}`;

        try {
            await axios.post(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
                chat_id: this.telegramChatId,
                text,
                parse_mode: 'Markdown'
            });
        } catch (e: any) {
            logger.error(`[AlertService] Failed to send Telegram alert: ${e.message}`);
        }
    }
}

// Export a singleton instance for ease of use
export const alertService = new AlertService();
