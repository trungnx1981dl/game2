const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionView.tsx', 'utf8');

code = code.replace(
  "            {/* Answer Modes */}",
  `          </div>

          {/* Answer Card */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 border-2 border-blue-500 shadow-xl shadow-blue-200/50 space-y-6 relative overflow-hidden transition-colors duration-500 hover:border-blue-600 hover:shadow-blue-300/50">
            {/* Blue Accent line */}
            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-indigo-600" />
            
            <div className="text-xs font-bold text-slate-400 mb-2">
              <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded">PHƯƠNG ÁN TRẢ LỜI</span>
            </div>

            {/* Answer Modes */}`
);

fs.writeFileSync('src/components/QuestionView.tsx', code);
console.log('Cards split');
