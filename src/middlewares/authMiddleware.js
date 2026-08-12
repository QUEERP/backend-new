const prisma = require("../config/prisma");
const { verifyToken, extractTokenFromHeader } = require("../utils/jwtUtils");

const authMiddleware = async (req, res, next) => {
  try {
    // SAFE DEBUG LOGGING
    console.log(`[AUTH DEBUG] Path: ${req.path}`);
    console.log(`[AUTH DEBUG] Auth header exists: ${!!req.headers.authorization}`);
    console.log(`[AUTH DEBUG] Cookie token exists: ${!!(req.headers.cookie && req.headers.cookie.includes('token='))}`);

    const token = extractTokenFromHeader(req);

    if (!token) {
      console.log(`[AUTH DEBUG] No token found. Returning 401.`);
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    console.log(`[AUTH DEBUG] Token extracted successfully (Length: ${token.length})`);

    const { success, payload, error } = verifyToken(token);

    if (!success) {
      return res.status(401).json({
        success: false,
        message: error?.message || "Invalid token",
      });
    }

    //////////////////////////////////////////////////////
    // REQUIRED PAYLOAD VALIDATION
    //////////////////////////////////////////////////////
    if (!payload.userId || !payload.email || !payload.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    //////////////////////////////////////////////////////
    // ⭐ SUBSCRIPTION ADMIN
    //////////////////////////////////////////////////////
    if (payload.userId === "subscription-admin") {
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        isActive: true,
        activeBusinessId: null,
        employeeId: null
      };

      return next();
    }

    //////////////////////////////////////////////////////
    // NORMAL USER
    //////////////////////////////////////////////////////
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        activeBusinessId: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    //////////////////////////////////////////////////////
    // ⭐ CHECK IF USER IS EMPLOYEE
    //////////////////////////////////////////////////////
    const employee = await prisma.employee.findFirst({
      where: {
        userId: user.id
      },
      select: {
        id: true
      }
    });

    //////////////////////////////////////////////////////
    // FINAL USER OBJECT
    //////////////////////////////////////////////////////
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      activeBusinessId: user.activeBusinessId || null,
      employeeId: employee ? employee.id : null   // ⭐ IMPORTANT
    };
   // ⭐ ADD THIS
req.business = {
  id: user.activeBusinessId
};
    next();

  } catch (err) {
    console.error("Auth middleware error:", err);

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;