const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'mobile', 'src', 'data');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Extracting data files for Mobile app...');

// 1. Extract programs from courses_data.js
global.window = {};
const coursesContent = fs.readFileSync(path.join(__dirname, 'courses_data.js'), 'utf8');
eval(coursesContent.replace('const ALL_PROGRAMS_DATA', 'global.ALL_PROGRAMS_DATA'));
const programs = global.ALL_PROGRAMS_DATA || {};
fs.writeFileSync(path.join(targetDir, 'programs.json'), JSON.stringify(programs), 'utf8');
console.log(`[OK] programs.json saved: ${Object.keys(programs).length} programs.`);

// 2. Extract classrooms from data.js
const classroomsContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
eval(classroomsContent.replace('const CLASSROOMS_DATA', 'global.CLASSROOMS_DATA'));
const classrooms = global.CLASSROOMS_DATA || {};
fs.writeFileSync(path.join(targetDir, 'classrooms.json'), JSON.stringify(classrooms), 'utf8');
console.log(`[OK] classrooms.json saved: ${Object.keys(classrooms).length} classrooms.`);

// 3. Copy exam_schedules.json
const examPath = path.join(__dirname, 'exam_schedules.json');
if (fs.existsSync(examPath)) {
  const exams = JSON.parse(fs.readFileSync(examPath, 'utf8'));
  fs.writeFileSync(path.join(targetDir, 'exams.json'), JSON.stringify(exams), 'utf8');
  console.log(`[OK] exams.json saved: ${exams.meta?.total_departments || Object.keys(exams.departments || {}).length} departments.`);
}

console.log('All mobile data exported successfully!');
