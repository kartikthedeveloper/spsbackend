
// Generates sequential IDs like:
// SP-2026-0001
// LD-2026-0001
// RCPT-2026-0001

const generateId = async (Model, fieldName, prefix) => {
  const year = new Date().getFullYear();

  // Find highest existing ID instead of counting documents
  const lastDocument = await Model.findOne({
    [fieldName]: {
      $regex: `^${prefix}-${year}-\\d+$`,
    },
  })
    .sort({ [fieldName]: -1 })
    .select(fieldName)
    .lean();

  let lastNumber = 0;

  if (lastDocument && lastDocument[fieldName]) {
    const parts = lastDocument[fieldName].split('-');
    lastNumber = Number(parts[parts.length - 1]) || 0;
  }

  const nextNumber = String(lastNumber + 1).padStart(4, '0');

  return `${prefix}-${year}-${nextNumber}`;
};

module.exports = { generateId };
