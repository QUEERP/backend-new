const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");
const { logAction, triggerNotification } = require("../services/sales/audit.service");

const mapToProposalStatus = (status) => {
  if (!status) return 'DRAFT';
  const s = String(status).toUpperCase().replace(/[\s-]+/g, '_');
  if (s.includes('PENDING') || s.includes('REVIEW') || s.includes('SUBMIT')) return 'PENDING_APPROVAL';
  if (s === 'APPROVED' || s === 'ACCEPTED') return 'APPROVED';
  if (s === 'REJECTED') return 'REJECTED';
  if (s === 'SENT') return 'SENT';
  if (s === 'EXPIRED') return 'EXPIRED';
  if (s === 'CANCELLED') return 'CANCELLED';
  return 'DRAFT';
};

// ==========================================
// CREATE PROPOSAL
// ==========================================
exports.createProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const body = req.body;

    // Resolve customer ID
    const customerId = body.customer?.id || body.customer || body.customerId;
    let validCustomerId = null;
    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerId, businessId }
      });
      if (cust) validCustomerId = cust.id;
    }
    if (!validCustomerId) {
      const firstCust = await prisma.customer.findFirst({
        where: { businessId }
      });
      if (firstCust) validCustomerId = firstCust.id;
    }

    if (!validCustomerId) {
      return errorResponse(res, "A valid customer is required to create a proposal", 400);
    }

    let quoteNumber = body.propNumber || body.quoteNumber;
    if (!quoteNumber || !String(quoteNumber).startsWith('PRP-')) {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      quoteNumber = `PRP-${randomSuffix}`;
    }

    const proposalStatus = mapToProposalStatus(body.status);
    const subtotal = Number(body.subtotal !== undefined ? body.subtotal : (Number(body.matCost || 0) + Number(body.labCost || 0)));
    const totalAmount = Number(body.finalPrice !== undefined ? body.finalPrice : (body.totalAmount || subtotal));
    const discount = Number(body.discount || 0);
    const tax = Number(body.tax || 0);
    const issueDate = body.propDate ? new Date(body.propDate) : (body.issueDate ? new Date(body.issueDate) : new Date());
    const expiryDate = body.validUntil ? new Date(body.validUntil) : (body.expiryDate ? new Date(body.expiryDate) : null);
    const exchangeRate = Number(body.exchangeRate || 1);
    const title = body.propName || body.title || 'Proposal';
    const notes = body.appNotes || body.termLegal || body.notes || '';
    const currency = body.currency || 'USD';

    // Build line items
    let itemsData = [];
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      itemsData = body.items.map(item => ({
        productId: item.productId || null,
        description: item.description || item.itemName || 'Proposal Scope Item',
        quantity: Number(item.quantity || 1),
        price: Number(item.price || item.rate || 0),
        total: Number(item.total || ((Number(item.quantity || 1) * Number(item.price || item.rate || 0)))),
        taxPercent: Number(item.taxPercent || 0),
        unit: item.unit || 'pcs',
        itemType: item.itemType || 'SERVICE'
      }));
    } else {
      itemsData = [{
        description: title + ' - Scope & Deliverables',
        quantity: 1,
        price: totalAmount,
        total: totalAmount,
        unit: 'lot',
        itemType: 'SERVICE'
      }];
    }

    // Check if proposal with quoteNumber already exists
    const existing = await prisma.quotation.findFirst({
      where: { businessId, quoteNumber }
    });

    let proposal = null;
    if (existing) {
      await prisma.quotationItem.deleteMany({ where: { quotationId: existing.id } });
      proposal = await prisma.quotation.update({
        where: { id: existing.id },
        data: {
          title,
          customerId: validCustomerId,
          status: proposalStatus,
          subtotal,
          discount,
          tax,
          totalAmount,
          currency,
          exchangeRate,
          issueDate,
          expiryDate,
          notes,
          items: {
            create: itemsData
          }
        },
        include: { customer: true, items: true, assignedTo: { include: { user: true } }, deal: true }
      });
    } else {
      proposal = await prisma.quotation.create({
        data: {
          businessId,
          quoteNumber,
          title,
          customerId: validCustomerId,
          status: proposalStatus,
          subtotal,
          discount,
          tax,
          totalAmount,
          currency,
          exchangeRate,
          issueDate,
          expiryDate,
          notes,
          dealId: body.dealId || null,
          assignedToId: body.assignedToId || null,
          items: {
            create: itemsData
          }
        },
        include: { customer: true, items: true, assignedTo: { include: { user: true } }, deal: true }
      });
    }

    // Log Activity as Proposal
    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_CREATED",
      entityType: "Proposal",
      entityId: proposal.id,
      details: { proposalNumber: proposal.quoteNumber, title: proposal.title, totalAmount: proposal.totalAmount }
    });

    // Trigger Notification
    await triggerNotification(prisma, {
      businessId,
      userId,
      title: "Proposal Created",
      message: `Proposal ${proposal.quoteNumber} has been created successfully.`,
      type: "SUCCESS",
      entityType: "Proposal",
      entityId: proposal.id
    });

    return res.status(201).json({
      success: true,
      message: "Proposal created successfully",
      proposal,
      data: proposal
    });
  } catch (error) {
    console.error("createProposal controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// GET PROPOSALS LIST
// ==========================================
exports.getProposals = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { customerId, status } = req.query;

    const where = {
      businessId,
      isDeleted: false,
      OR: [
        { quoteNumber: { startsWith: 'PRP-' } },
        { quoteNumber: { contains: 'PRP' } },
        { title: { contains: 'Proposal', mode: 'insensitive' } }
      ]
    };

    if (customerId) where.customerId = customerId;
    if (status) {
      const s = String(status).toUpperCase();
      if (s === 'APPROVED' || s === 'ACCEPTED') {
        where.status = { in: ['APPROVED', 'ACCEPTED'] };
      } else {
        where.status = s;
      }
    }

    const proposals = await prisma.quotation.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: { product: true }
        },
        assignedTo: {
          include: { user: true }
        },
        deal: true
      },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    return res.status(200).json({
      success: true,
      message: "Proposals fetched successfully",
      proposals,
      data: proposals
    });
  } catch (error) {
    console.error("getProposals controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// GET PROPOSAL BY ID
// ==========================================
exports.getProposalById = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      },
      include: {
        customer: true,
        contact: true,
        items: { include: { product: true } },
        assignedTo: { include: { user: true } },
        deal: true
      }
    });

    if (!proposal) {
      return errorResponse(res, "Proposal not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Proposal retrieved successfully",
      proposal,
      data: proposal,
      quotation: proposal // for backward compatibility
    });
  } catch (error) {
    console.error("getProposalById controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// UPDATE PROPOSAL
// ==========================================
exports.updateProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      },
      include: { items: true }
    });

    if (!existing) {
      return errorResponse(res, "Proposal not found", 404);
    }

    let status = existing.status;
    if (body.status) {
      status = mapToProposalStatus(body.status);
    }

    const updateData = {
      status,
      title: body.title || body.propName || existing.title,
      notes: body.notes !== undefined ? body.notes : (body.appNotes || body.termLegal || existing.notes),
      currency: body.currency || existing.currency,
      exchangeRate: body.exchangeRate !== undefined ? Number(body.exchangeRate) : existing.exchangeRate,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : (body.validUntil ? new Date(body.validUntil) : existing.expiryDate),
      issueDate: body.issueDate ? new Date(body.issueDate) : (body.propDate ? new Date(body.propDate) : existing.issueDate),
    };

    if (body.customerId || body.customer) {
      const custId = body.customer?.id || body.customer || body.customerId;
      const validCust = await prisma.customer.findFirst({ where: { id: custId, businessId } });
      if (validCust) updateData.customerId = validCust.id;
    }

    if (body.totalAmount !== undefined || body.finalPrice !== undefined) {
      updateData.totalAmount = Number(body.finalPrice !== undefined ? body.finalPrice : body.totalAmount);
    }
    if (body.subtotal !== undefined || body.matCost !== undefined) {
      updateData.subtotal = Number(body.subtotal !== undefined ? body.subtotal : (Number(body.matCost || 0) + Number(body.labCost || 0)));
    }
    if (body.discount !== undefined) updateData.discount = Number(body.discount);
    if (body.tax !== undefined) updateData.tax = Number(body.tax);

    if (body.items && Array.isArray(body.items)) {
      await prisma.quotationItem.deleteMany({ where: { quotationId: existing.id } });
      updateData.items = {
        create: body.items.map(item => ({
          productId: item.productId || null,
          description: item.description || item.itemName || 'Proposal Scope Item',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || item.rate || 0),
          total: Number(item.total || ((Number(item.quantity || 1) * Number(item.price || item.rate || 0)))),
          taxPercent: Number(item.taxPercent || 0),
          unit: item.unit || 'pcs',
          itemType: item.itemType || 'SERVICE'
        }))
      };
    }

    const updated = await prisma.quotation.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        customer: true,
        items: true,
        assignedTo: { include: { user: true } },
        deal: true
      }
    });

    const isApproved = status === 'APPROVED' || status === 'ACCEPTED';
    const isRejected = status === 'REJECTED';
    const actionVerb = isApproved ? 'approved' : isRejected ? 'rejected' : 'updated';
    const action = isApproved ? 'PROPOSAL_APPROVED' : isRejected ? 'PROPOSAL_REJECTED' : 'PROPOSAL_UPDATED';

    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action,
      entityType: "Proposal",
      entityId: updated.id,
      details: { oldStatus: existing.status, newStatus: status, proposalNumber: updated.quoteNumber }
    });

    if (isApproved || isRejected || status !== existing.status) {
      await triggerNotification(prisma, {
        businessId,
        userId,
        title: `Proposal ${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}`,
        message: `Proposal ${updated.quoteNumber} has been ${actionVerb}.`,
        type: isApproved ? "SUCCESS" : isRejected ? "WARNING" : "INFO",
        entityType: "Proposal",
        entityId: updated.id
      });
    }

    return res.status(200).json({
      success: true,
      message: `Proposal ${actionVerb} successfully`,
      proposal: updated,
      data: updated
    });
  } catch (error) {
    console.error("updateProposal controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// APPROVE PROPOSAL
// ==========================================
exports.approveProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      }
    });

    if (!proposal) {
      return errorResponse(res, "Proposal not found", 404);
    }

    const updated = await prisma.quotation.update({
      where: { id: proposal.id },
      data: { status: "APPROVED" },
      include: {
        customer: true,
        items: true,
        deal: true,
        assignedTo: { include: { user: true } }
      }
    });

    // Log Activity as Proposal
    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_APPROVED",
      entityType: "Proposal",
      entityId: updated.id,
      details: { oldStatus: proposal.status, newStatus: "APPROVED", proposalNumber: updated.quoteNumber }
    });

    // Trigger Notification for Proposal
    await triggerNotification(prisma, {
      businessId,
      userId,
      title: "Proposal Approved",
      message: `Proposal ${updated.quoteNumber} has been approved successfully.`,
      type: "SUCCESS",
      entityType: "Proposal",
      entityId: updated.id
    });

    return res.status(200).json({
      success: true,
      message: "Proposal approved successfully",
      proposal: updated,
      data: updated
    });
  } catch (error) {
    console.error("approveProposal controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// REJECT PROPOSAL
// ==========================================
exports.rejectProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      }
    });

    if (!proposal) {
      return errorResponse(res, "Proposal not found", 404);
    }

    const updated = await prisma.quotation.update({
      where: { id: proposal.id },
      data: { status: "REJECTED" },
      include: {
        customer: true,
        items: true,
        deal: true,
        assignedTo: { include: { user: true } }
      }
    });

    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_REJECTED",
      entityType: "Proposal",
      entityId: updated.id,
      details: { oldStatus: proposal.status, newStatus: "REJECTED", proposalNumber: updated.quoteNumber }
    });

    await triggerNotification(prisma, {
      businessId,
      userId,
      title: "Proposal Rejected",
      message: `Proposal ${updated.quoteNumber} has been rejected.`,
      type: "INFO",
      entityType: "Proposal",
      entityId: updated.id
    });

    return res.status(200).json({
      success: true,
      message: "Proposal rejected successfully",
      proposal: updated,
      data: updated
    });
  } catch (error) {
    console.error("rejectProposal controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// SUBMIT PROPOSAL FOR APPROVAL
// ==========================================
exports.submitProposalApproval = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      }
    });

    if (!proposal) {
      return errorResponse(res, "Proposal not found", 404);
    }

    const updated = await prisma.quotation.update({
      where: { id: proposal.id },
      data: { status: "PENDING_APPROVAL" },
      include: { customer: true, items: true }
    });

    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_SUBMITTED_APPROVAL",
      entityType: "Proposal",
      entityId: updated.id,
      details: { proposalNumber: updated.quoteNumber }
    });

    await triggerNotification(prisma, {
      businessId,
      userId,
      title: "Proposal Submitted for Approval",
      message: `Proposal ${updated.quoteNumber} submitted for approval.`,
      type: "INFO",
      entityType: "Proposal",
      entityId: updated.id
    });

    return res.status(200).json({
      success: true,
      message: "Proposal submitted for approval successfully",
      proposal: updated,
      data: updated,
      id: updated.id,
      status: "Pending Approval"
    });
  } catch (error) {
    console.error("submitProposalApproval error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// SEND PROPOSAL
// ==========================================
exports.sendProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      }
    });

    if (!proposal) {
      return errorResponse(res, "Proposal not found", 404);
    }

    const updated = await prisma.quotation.update({
      where: { id: proposal.id },
      data: { status: "SENT" },
      include: { customer: true, items: true }
    });

    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_SENT",
      entityType: "Proposal",
      entityId: updated.id,
      details: { proposalNumber: updated.quoteNumber }
    });

    await triggerNotification(prisma, {
      businessId,
      userId,
      title: "Proposal Sent",
      message: `Proposal ${updated.quoteNumber} has been sent successfully.`,
      type: "INFO",
      entityType: "Proposal",
      entityId: updated.id
    });

    return res.status(200).json({
      success: true,
      message: "Proposal sent successfully",
      proposal: updated,
      data: updated,
      id: updated.id,
      status: "Sent"
    });
  } catch (error) {
    console.error("sendProposal error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// DELETE PROPOSAL
// ==========================================
exports.deleteProposal = async (req, res) => {
  try {
    const businessId = req.business.id;
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const { id } = req.params;

    const existing = await prisma.quotation.findFirst({
      where: {
        businessId,
        isDeleted: false,
        OR: [{ id }, { quoteNumber: id }]
      }
    });

    if (!existing) {
      return errorResponse(res, "Proposal not found", 404);
    }

    await prisma.quotation.update({
      where: { id: existing.id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    await logAction(prisma, {
      businessId,
      userId,
      userEmail,
      action: "PROPOSAL_DELETED",
      entityType: "Proposal",
      entityId: existing.id,
      details: { proposalNumber: existing.quoteNumber }
    });

    return res.status(200).json({
      success: true,
      message: "Proposal deleted successfully"
    });
  } catch (error) {
    console.error("deleteProposal controller error:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==========================================
// DOWNLOAD PROPOSAL PDF
// ==========================================
exports.downloadProposalPdf = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const proposal = await prisma.quotation.findFirst({
      where: {
        businessId,
        OR: [{ id }, { quoteNumber: id }]
      },
      include: {
        customer: true,
        contact: true,
        items: { include: { product: true } },
        assignedTo: { include: { user: true } },
        deal: true
      }
    });

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    const [settings, business] = await Promise.all([
      prisma.settings.findUnique({ where: { businessId } }),
      prisma.business.findUnique({ where: { id: businessId } }),
    ]);

    const pdfSettings = {
      ...(settings || {}),
      businessType: business?.businessType || 'Enterprise',
      companyName: settings?.companyName || business?.name || "Company",
      address: settings?.address || [business?.address, business?.city, business?.country].filter(Boolean).join(", "),
      phone: settings?.phone || business?.phone || "",
      email: settings?.email || business?.email || "",
      trn: settings?.trn || business?.vatNumber || business?.taxNumber || "",
      signatureUrl: settings?.signatureUrl || null,
      documentType: "PROPOSAL"
    };

    const generateProposalPdf = require("../utils/generateProposalPdf");
    const pdfBuffer = await generateProposalPdf(proposal, pdfSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Proposal_${proposal.quoteNumber || id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("downloadProposalPdf controller error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

