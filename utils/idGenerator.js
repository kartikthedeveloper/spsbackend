// Generates human-friendly sequential IDs like SP-2026-0001, LD-2026-0001, RCPT-2026-0001
// by counting existing documents for the current year. Good enough for a single
// institute's volume; avoids needing a paid ID/service provider.

const generateId = async (Model, fieldName, prefix) => {
  const year = new Date().getFullYear();
  const count = await Model.countDocuments({
    [fieldName]: { $regex: `^${prefix}-${year}-` },
  });
  const next = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${next}`;
};

module.exports = { generateId };
