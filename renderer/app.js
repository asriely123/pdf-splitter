// 阶段 1：窗口控制按钮
document.addEventListener('DOMContentLoaded', () => {
  const { pdfTool } = window;

  document.getElementById('btn-minimize').addEventListener('click', () => {
    pdfTool.minimize();
  });

  document.getElementById('btn-close').addEventListener('click', () => {
    pdfTool.close();
  });
});
