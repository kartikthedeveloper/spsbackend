require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Settings = require('../models/Settings');

const run = async () => {
  await connectDB();

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log('An admin user already exists:', existingAdmin.email);
    process.exit(0);
  }

  let branch = await Branch.findOne({ code: 'SIKAR-01' });
  if (!branch) {
    branch = await Branch.create({
      name: 'Success Point - Sikar Main',
      code: 'SIKAR-01',
      city: 'Sikar, Rajasthan',
      address: 'Main Market, Sikar, Rajasthan',
    });
    console.log('Created demo branch:', branch.name);
  }

  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@successpoint.local',
    password: 'Admin@123',
    role: 'admin',
  });
  console.log('Created admin user:');
  console.log('  email:    admin@successpoint.local');
  console.log('  password: Admin@123');
  console.log('Please log in and change this password immediately.');

  const settings = await Settings.findOne();
  if (!settings) {
    await Settings.create({ instituteName: 'Success Point Sikar' });
    console.log('Created default settings.');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
