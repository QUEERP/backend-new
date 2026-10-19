/**
 * Currency & Exchange Rate Controller
 */

const prisma = require('../config/prisma');
const { liveRateSyncService } = require('../services/fx/liveRateSyncService');

exports.getCurrencyRate = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { currencyCode, documentDate } = req.query;

    if (!currencyCode) {
      return res.status(400).json({ success: false, message: 'currencyCode is required' });
    }

    const rateData = await liveRateSyncService.resolveCommercialRate(
      businessId,
      currencyCode,
      documentDate ? new Date(documentDate) : new Date()
    );

    return res.json({
      success: true,
      data: rateData
    });
  } catch (error) {
    const isNoRate = error.message && error.message.includes('No exchange rate for');
    return res.status(isNoRate ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to resolve exchange rate',
      isNoRate
    });
  }
};

exports.refreshRates = async (req, res) => {
  try {
    const businessId = req.business.id;
    const result = await liveRateSyncService.syncRatesForBusiness(businessId, { forceRefresh: true });

    return res.json({
      success: true,
      message: `Refreshed exchange rates. Synced: ${result.syncedCount}, Skipped: ${result.skippedCount}`,
      data: result
    });
  } catch (error) {
    console.error('refreshRates controller error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to refresh exchange rates'
    });
  }
};

exports.getCurrenciesOverview = async (req, res) => {
  try {
    const businessId = req.business.id;
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    const baseCode = (business?.baseCurrency?.code || business?.currency || 'INR').toUpperCase();
    const currenciesInUse = await liveRateSyncService.getCurrenciesInUse(businessId);

    const baseCcy = await prisma.currency.findUnique({ where: { code: baseCode } });
    const overview = [];

    for (const ccyCode of currenciesInUse) {
      if (ccyCode === baseCode) {
        overview.push({
          currency: ccyCode,
          name: baseCcy?.name || ccyCode,
          symbol: baseCcy?.symbol || '₹',
          commercialRate: 1.0,
          statutoryRate: 1.0,
          source: 'BASE',
          effectiveDate: new Date(),
          fetchedAt: new Date(),
          isBase: true,
          ageHours: 0,
          warningLevel: 'NONE'
        });
        continue;
      }

      const foreignCcy = await prisma.currency.findUnique({ where: { code: ccyCode } });
      let commRate = null;
      let statRate = null;

      if (foreignCcy && baseCcy) {
        commRate = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrencyId: foreignCcy.id,
            toCurrencyId: baseCcy.id,
            rateType: 'COMMERCIAL'
          },
          orderBy: { effectiveDate: 'desc' }
        });

        statRate = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrencyId: foreignCcy.id,
            toCurrencyId: baseCcy.id,
            rateType: 'STATUTORY'
          },
          orderBy: { effectiveDate: 'desc' }
        });
      }

      const now = Date.now();
      const lastFetched = commRate ? new Date(commRate.fetchedAt || commRate.createdAt).getTime() : 0;
      const ageHours = lastFetched > 0 ? (now - lastFetched) / (1000 * 60 * 60) : 9999;
      const ageDays = ageHours / 24;

      let warningLevel = 'NONE';
      if (!commRate) {
        warningLevel = 'RED';
      } else if (ageDays > 7) {
        warningLevel = 'RED';
      } else if (ageHours > 24) {
        warningLevel = 'AMBER';
      }

      overview.push({
        currency: ccyCode,
        name: foreignCcy?.name || ccyCode,
        symbol: foreignCcy?.symbol || ccyCode,
        commercialRate: commRate ? Number(commRate.rate) : null,
        statutoryRate: statRate ? Number(statRate.rate) : null,
        source: commRate?.source || 'UNRECORDED',
        statutorySource: statRate?.source || null,
        effectiveDate: commRate?.effectiveDate || null,
        fetchedAt: commRate?.fetchedAt || commRate?.createdAt || null,
        statutoryEffectiveDate: statRate?.effectiveDate || null,
        isBase: false,
        ageHours,
        warningLevel
      });
    }

    return res.json({
      success: true,
      baseCurrency: baseCode,
      data: overview
    });
  } catch (error) {
    console.error('getCurrenciesOverview error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveStatutoryRate = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { currencyCode, rate, effectiveDate, source } = req.body;

    if (!currencyCode || !rate) {
      return res.status(400).json({ success: false, message: 'currencyCode and rate are required' });
    }

    const createdBy = req.user?.email || req.user?.id || 'USER';
    const record = await liveRateSyncService.saveStatutoryRate({
      businessId,
      currencyCode,
      rate: Number(rate),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      source: source || 'CBIC-Notified',
      createdBy
    });

    return res.json({
      success: true,
      message: 'Statutory exchange rate saved successfully',
      data: record
    });
  } catch (error) {
    console.error('saveStatutoryRate error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
