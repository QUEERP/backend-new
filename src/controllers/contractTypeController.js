const prisma = require("../config/prisma");

//////////////////////////////////////////////////////
// CREATE CONTRACT TYPE
//////////////////////////////////////////////////////
exports.createContractType = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    const type = await prisma.contractType.create({
      data: {
        name: name.trim(),
        businessId: req.business.id,
      },
    });

    res.status(201).json({
      success: true,
      type,
    });

  } catch (error) {
    console.error("createContractType error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// GET ALL TYPES
//////////////////////////////////////////////////////
exports.getContractTypes = async (req, res) => {
  try {
    let types = await prisma.contractType.findMany({
      where: {
        businessId: req.business.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Auto-seed industry standard contract types if none exist yet for this business
    if (!types || types.length === 0) {
      const defaultTypes = [
        "Master Services Agreement (MSA)",
        "Fixed-Price Agreement",
        "Time & Materials (T&M)",
        "Statement of Work (SOW)",
        "Non-Disclosure Agreement (NDA)",
        "Annual Maintenance Contract (AMC)",
        "Retainer Agreement",
        "Service Level Agreement (SLA)",
      ];

      for (const name of defaultTypes) {
        try {
          await prisma.contractType.create({
            data: {
              name,
              businessId: req.business.id,
            },
          });
        } catch (e) {
          // ignore duplicate
        }
      }

      types = await prisma.contractType.findMany({
        where: {
          businessId: req.business.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }

    res.json({
      success: true,
      types,
    });

  } catch (error) {
    console.error("getContractTypes error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// DELETE TYPE
//////////////////////////////////////////////////////
exports.deleteContractType = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.contractType.deleteMany({
      where: {
        id,
        businessId: req.business.id,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Type not found",
      });
    }

    res.json({
      success: true,
      message: "Type deleted",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
