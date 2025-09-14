// import formidable from "formidable";
// import fs from "fs";

// export async function parseForm(req, uploadDir = "public/uploads") {
//   return new Promise((resolve, reject) => {
//     // pastikan folder ada
//     fs.mkdirSync(uploadDir, { recursive: true });

//     const form = formidable({
//       multiples: false,
//       uploadDir: uploadDir,
//       keepExtensions: true,
//       filename: (name, ext, part) => {
//         return `${Date.now()}-${part.originalFilename}`;
//       },
//     });

//     form.parse(req, (err, fields, files) => {
//       if (err) reject(err);
//       resolve({ fields, files });
//     });
//   });
// }
