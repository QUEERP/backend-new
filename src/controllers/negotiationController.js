const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");

// Helper to format a ProjectMaster record as a Negotiation object
const formatNegotiation = (m, customerMap = {}) => {
  const cfg = (typeof m.config === 'object' && m.config !== null) ? m.config : {};
  const custId = cfg.customer || cfg.customerId;
  const customer = customerMap[custId] || (custId ? { id: custId, company: cfg.customerName || 'Customer' } : null);

  return {
    id: m.id,
    negNumber: cfg.negNumber || `NEG-${m.id.slice(0, 8)}`,
    name: m.name,
    dealName: m.name,
    customer,
    customerId: custId,
    stage: cfg.status || cfg.stage || 'New',
    priority: cfg.priority || 'Medium',
    amount: Number(cfg.finalAmount !== undefined ? cfg.finalAmount : (cfg.negAmount || cfg.origAmount || 0)),
    origAmount: Number(cfg.origAmount || 0),
    negAmount: Number(cfg.negAmount || 0),
    discountPct: Number(cfg.discountPct || 0),
    taxPct: Number(cfg.taxPct || 0),
    finalAmount: Number(cfg.finalAmount || 0),
    margin: Number(cfg.margin || 0),
    profitPct: Number(cfg.profitPct || 0),
    currency: cfg.currency || 'USD',
    expectedCloseDate: cfg.expectedClose || cfg.expectedCloseDate || null,
    linkedProposal: cfg.linkedProposal || null,
    salesOwner: cfg.salesOwner || null,
    probability: Number(cfg.probability || 0),
    paymentTerms: cfg.paymentTerms || '',
    addedScope: cfg.addedScope || '',
    removedScope: cfg.removedScope || '',
    modifiedScope: cfg.modifiedScope || '',
    finalTimeline: cfg.finalTimeline || '',
    config: cfg,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt
  };
};

// ==========================================
// GET NEGOTIATIONS
// ==========================================
exports.getNegotiations = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { stage, customerId, search } = req.query;

    const masters = await prisma.projectMaster.findMany({
      where: {
        businessId,
        type: 'NEGOTIATION',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Collect all customer IDs to batch fetch
    const customerIds = Array.from(new Set(
      masters
        .map(m => (m.config && typeof m.config === 'object') ? (m.config.customer || m.config.customerId) : null)
        .filter(Boolean)
    ));

    let customerMap = {};
    if (customerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds }, businessId },
        select: { id: true, company: true, phone: true, email: true }
      });
      customers.forEach(c => {
        customerMap[c.id] = c;
      });
    }

    let negotiations = masters.map(m => formatNegotiation(m, customerMap));

    if (stage) {
      negotiations = negotiations.filter(n => (n.stage || '').toLowerCase() === String(stage).toLowerCase());
    }
    if (customerId) {
      negotiations = negotiations.filter(n => n.customerId === customerId);
    }
    if (search) {
      const s = String(search).toLowerCase();
      negotiations = negotiations.filter(n => 
        (n.name || '').toLowerCase().includes(s) || 
        (n.negNumber || '').toLowerCase().includes(s) ||
        (n.customer?.company || '').toLowerCase().includes(s)
      );
    }

    return res.status(200).json({
      success: true,
      negotiations,
      data: negotiations
    });
  } catch (error) {
    console.error("getNegotiations error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// GET NEGOTIATION BY ID
// ==========================================
exports.getNegotiationById = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const master = await prisma.projectMaster.findFirst({
      where: {
        id,
        businessId,
        type: 'NEGOTIATION',
        isActive: true
      }
    });

    if (!master) {
      return errorResponse(res, "Negotiation not found", 404);
    }

    const cfg = (typeof master.config === 'object' && master.config !== null) ? master.config : {};
    const custId = cfg.customer || cfg.customerId;
    let customerMap = {};
    if (custId) {
      const customer = await prisma.customer.findFirst({
        where: { id: custId, businessId },
        select: { id: true, company: true, phone: true, email: true }
      });
      if (customer) customerMap[customer.id] = customer;
    }

    const negotiation = formatNegotiation(master, customerMap);

    return res.status(200).json({
      success: true,
      negotiation,
      data: negotiation
    });
  } catch (error) {
    console.error("getNegotiationById error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// CREATE NEGOTIATION
// ==========================================
exports.createNegotiation = async (req, res) => {
  try {
    const businessId = req.business.id;
    const body = req.body;

    const name = body.dealName || body.name || `Negotiation - ${Date.now().toString().slice(-4)}`;
    const negNumber = body.negNumber || `NEG-${Math.floor(100000 + Math.random() * 900000)}`;
    const config = {
      ...body,
      negNumber,
      status: body.status || body.stage || 'New'
    };

    const master = await prisma.projectMaster.create({
      data: {
        businessId,
        type: 'NEGOTIATION',
        name,
        description: body.privNotes || body.salesNotes || body.addedScope || '',
        config,
        isActive: true
      }
    });

    let customerMap = {};
    const custId = config.customer || config.customerId;
    if (custId) {
      const customer = await prisma.customer.findFirst({
        where: { id: custId, businessId },
        select: { id: true, company: true, phone: true, email: true }
      });
      if (customer) customerMap[customer.id] = customer;
    }

    const negotiation = formatNegotiation(master, customerMap);

    return res.status(201).json({
      success: true,
      message: "Negotiation created successfully",
      negotiation,
      data: negotiation
    });
  } catch (error) {
    console.error("createNegotiation error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// UPDATE NEGOTIATION
// ==========================================
exports.updateNegotiation = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.projectMaster.findFirst({
      where: { id, businessId, type: 'NEGOTIATION' }
    });

    if (!existing) {
      return errorResponse(res, "Negotiation not found", 404);
    }

    const existingConfig = (typeof existing.config === 'object' && existing.config !== null) ? existing.config : {};
    const name = body.dealName || body.name || existing.name;
    const updatedConfig = {
      ...existingConfig,
      ...body,
      status: body.stage || body.status || existingConfig.status || 'New'
    };

    const updated = await prisma.projectMaster.update({
      where: { id: existing.id },
      data: {
        name,
        description: body.privNotes || body.salesNotes || existing.description,
        config: updatedConfig
      }
    });

    let customerMap = {};
    const custId = updatedConfig.customer || updatedConfig.customerId;
    if (custId) {
      const customer = await prisma.customer.findFirst({
        where: { id: custId, businessId },
        select: { id: true, company: true, phone: true, email: true }
      });
      if (customer) customerMap[customer.id] = customer;
    }

    const negotiation = formatNegotiation(updated, customerMap);

    return res.status(200).json({
      success: true,
      message: "Negotiation updated successfully",
      negotiation,
      data: negotiation
    });
  } catch (error) {
    console.error("updateNegotiation error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// DELETE NEGOTIATION
// ==========================================
exports.deleteNegotiation = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const existing = await prisma.projectMaster.findFirst({
      where: { id, businessId, type: 'NEGOTIATION' }
    });

    if (!existing) {
      return errorResponse(res, "Negotiation not found", 404);
    }

    await prisma.projectMaster.delete({
      where: { id: existing.id }
    });

    return res.status(200).json({
      success: true,
      message: "Negotiation deleted successfully"
    });
  } catch (error) {
    console.error("deleteNegotiation error:", error);
    return errorResponse(res, error.message, 500);
  }
};

