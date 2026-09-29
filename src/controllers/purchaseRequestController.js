const prisma = require("../config/prisma");
const crypto = require("crypto");

//////////////////////////////////////////////////////
// CREATE PURCHASE REQUEST
//////////////////////////////////////////////////////
exports.createPurchaseRequest = async (req, res) => {
  try {
    const businessId = req.business.id;
    const {
      requestNumber,
      department,
      status = "DRAFT",
      notes,
      title,
      vendorId,
      requiredDate,
      priority,
      items, // array of { productId, description, quantity, estimatedPrice, itemType, hsnSacCode }
    } = req.body;

    const prId = crypto.randomUUID();

    // Generate requestNumber if not provided
    const finalRequestNumber = requestNumber || `PR-${Date.now()}`;

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        id: prId,
        businessId,
        requestNumber: finalRequestNumber,
        department,
        requesterId: req.membership?.id || null,
        status,
        notes,
        title,
        vendorId,
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        priority,
        items: {
          create: items.map((item) => ({
            id: crypto.randomUUID(),
            productId: item.productId || undefined,
            description: item.description,
            quantity: Number(item.quantity) || 1,
            estimatedPrice: Number(item.estimatedPrice) || 0,
          })).filter(i => i.productId || i.description), // Basic validation
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({
      success: true,
      request: purchaseRequest,
    });
  } catch (error) {
    console.error("createPurchaseRequest error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET ALL PURCHASE REQUESTS
//////////////////////////////////////////////////////
exports.getPurchaseRequests = async (req, res) => {
  try {
    const businessId = req.business.id;

    const requests = await prisma.purchaseRequest.findMany({
      where: { businessId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        requester: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("getPurchaseRequests error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET PURCHASE REQUEST BY ID
//////////////////////////////////////////////////////
exports.getPurchaseRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const request = await prisma.purchaseRequest.findFirst({
      where: { id, businessId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        requester: {
          include: {
            user: true
          }
        }
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Purchase Request not found",
      });
    }

    res.json({
      success: true,
      request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// UPDATE PURCHASE REQUEST
//////////////////////////////////////////////////////
exports.updatePurchaseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;
    const { items, ...updateData } = req.body;

    const existing = await prisma.purchaseRequest.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Purchase Request not found",
      });
    }

    const updatedData = { ...updateData };
    if (updatedData.requiredDate) {
      updatedData.requiredDate = new Date(updatedData.requiredDate).toISOString();
    }
    
    if (updatedData.status === 'CONVERTED') {
      updatedData.status = 'CONVERTED_TO_PO';
    }
    
    // First update the base fields
    let updated = await prisma.purchaseRequest.update({
      where: { id },
      data: updatedData
    });

    // Handle items if provided
    if (items && Array.isArray(items)) {
      // Delete old items
      await prisma.purchaseRequestItem.deleteMany({
        where: { purchaseRequestId: id }
      });

      // Create new items
      const validItems = items.map((item) => ({
        id: crypto.randomUUID(),
        productId: item.productId || undefined,
        description: item.description,
        quantity: Number(item.quantity) || 1,
        estimatedPrice: Number(item.estimatedPrice) || 0,
      })).filter(i => i.productId || i.description);

      if (validItems.length > 0) {
        await prisma.purchaseRequest.update({
          where: { id },
          data: {
            items: {
              create: validItems
            }
          }
        });
      }
      
      updated = await prisma.purchaseRequest.findUnique({
        where: { id },
        include: { items: true }
      });
    }

    res.json({
      success: true,
      request: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
