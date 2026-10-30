/**
 * Formats database (Prisma) and server errors into clean, human-readable messages
 * so end users can easily understand what went wrong without seeing raw code or stack traces.
 */

function formatPrismaError(err) {
  if (!err) return "An unexpected error occurred. Please try again.";

  // 1. Prisma Known Request Errors by Error Code (P2002, P2003, P2025, etc.)
  if (err.code) {
    switch (err.code) {
      case "P2002": {
        const targets = err.meta?.target;
        let fieldStr = "this value";
        if (Array.isArray(targets) && targets.length > 0) {
          fieldStr = targets.join(", ");
        } else if (typeof targets === "string") {
          fieldStr = targets.replace(/_key$/, "").replace(/.*_/, "");
        }
        return `A record with this ${fieldStr} already exists. Please use a unique value.`;
      }
      case "P2003": {
        const field = err.meta?.field_name || "item";
        const cleanField = String(field).replace(/_fkey$/, "").replace(/.*_/, "").replace(/Id$/i, "");
        return `The selected ${cleanField} does not exist or has been deleted.`;
      }
      case "P2025": {
        return "The requested record was not found or has already been deleted.";
      }
      case "P2000": {
        return "The provided value is too long for one of the fields.";
      }
      case "P2011": {
        const constraint = err.meta?.constraint || "field";
        return `Required field '${constraint}' is missing. Please provide a value.`;
      }
      case "P2005":
      case "P2006": {
        return "The value provided for one of the fields is invalid.";
      }
      default:
        break;
    }
  }

  // 2. Parse Raw Prisma Validation Errors
  const rawMsg = typeof err === "string" ? err : err.message || "";
  if (!rawMsg) return "An unexpected error occurred. Please try again.";

  if (rawMsg.includes("prisma.") || rawMsg.includes("invocation") || rawMsg.includes("PrismaClient")) {
    // 2.1. Invalid value for argument
    const invalidArgMatch = rawMsg.match(/Invalid value for argument `?([a-zA-Z0-9_]+)`?(?:\. Expected ([a-zA-Z0-9_<>?, ]+))?/i);
    if (invalidArgMatch) {
      const field = invalidArgMatch[1];
      const rawExpected = (invalidArgMatch[2] || "").trim();
      let friendlyExpected = "";

      if (/LeadPriority/i.test(rawExpected)) {
        friendlyExpected = "one of: Low, Medium, High, Critical";
      } else if (/LeadSource/i.test(rawExpected)) {
        friendlyExpected = "a valid lead source (e.g. Website, Referral, LinkedIn, Partner, etc.)";
      } else if (/LeadStatus/i.test(rawExpected)) {
        friendlyExpected = "a valid status (e.g. New, Contacted, Qualified, etc.)";
      } else if (/ExecutionType/i.test(rawExpected)) {
        friendlyExpected = "one of: Auto Detect, Service, Product, Hybrid";
      } else if (/ContractStatus/i.test(rawExpected)) {
        friendlyExpected = "one of: Active, Inactive, Completed, Terminated";
      } else if (/DateTime/i.test(rawExpected)) {
        friendlyExpected = "a valid date";
      } else if (/Float|Int|Decimal/i.test(rawExpected)) {
        friendlyExpected = "a valid number";
      } else if (/Boolean/i.test(rawExpected)) {
        friendlyExpected = "true or false";
      } else if (rawExpected) {
        friendlyExpected = rawExpected;
      }

      return `Invalid value provided for '${field}'.${friendlyExpected ? ` Expected ${friendlyExpected}.` : " Please check this field and try again."}`;
    }

    // 2.2. Missing required argument
    const missingArgMatch = rawMsg.match(/Argument `?([a-zA-Z0-9_]+)`? is missing/i);
    if (missingArgMatch) {
      return `Required field '${missingArgMatch[1]}' is missing. Please fill it out.`;
    }

    // 2.3. Unique constraint failure inside message
    const uniqueMatch = rawMsg.match(/Unique constraint failed on the (?:constraint|fields): `?([^`\n\)]+)`?/i);
    if (uniqueMatch) {
      const field = uniqueMatch[1].replace(/_key$/, "").replace(/.*_/, "");
      return `A record with this ${field} already exists. Please use a unique value.`;
    }

    // 2.4. Foreign key constraint failure inside message
    const foreignKeyMatch = rawMsg.match(/Foreign key constraint failed on the field: `?([a-zA-Z0-9_]+)`?/i);
    if (foreignKeyMatch) {
      const ref = foreignKeyMatch[1].replace(/Id$/i, "");
      return `The selected ${ref} does not exist or has been removed.`;
    }

    // 2.5. Unknown argument / field
    const unknownMatch = rawMsg.match(/Unknown (?:argument|field) `?([a-zA-Z0-9_]+)`?/i);
    if (unknownMatch) {
      return `Unrecognized field '${unknownMatch[1]}' in submission.`;
    }

    // 2.6. Record not found
    if (/Record to (?:update|delete) not found/i.test(rawMsg)) {
      return "The requested record was not found or has already been deleted.";
    }

    // 2.7. Fallback: extract the concluding human sentence if present
    const lines = rawMsg.split("\n").map(l => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    if (
      lastLine &&
      !lastLine.includes("prisma.") &&
      !lastLine.includes("{") &&
      !lastLine.includes("}") &&
      !lastLine.includes("-->") &&
      !lastLine.includes("~~") &&
      lastLine.length < 250
    ) {
      return lastLine;
    }

    return "A database validation error occurred. Please verify your input and try again.";
  }

  // If not a Prisma error, return message or clean fallback
  return rawMsg;
}

module.exports = {
  formatPrismaError,
};

