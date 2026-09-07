from pathlib import Path
from tempfile import TemporaryDirectory

import pymupdf
from pptx import Presentation
from pptx.util import Inches


SOURCE = Path("/home/ubuntu/.cursor/projects/workspace/uploads/yoolax-__ppt_a411.pdf")
OUTPUT = Path("/workspace/yoolax-述职报告.pptx")


def main() -> None:
    document = pymupdf.open(SOURCE)
    if not document.page_count:
        raise ValueError("The source PDF has no pages.")

    first_page = document[0]
    aspect_ratio = first_page.rect.width / first_page.rect.height

    presentation = Presentation()
    presentation.slide_width = Inches(10)
    presentation.slide_height = int(presentation.slide_width / aspect_ratio)
    blank_layout = presentation.slide_layouts[6]

    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        for page_number, page in enumerate(document, start=1):
            image_path = temporary_path / f"slide-{page_number:02d}.png"
            # Render at 1920x1080 for crisp 16:9 presentation playback.
            scale = 1920 / page.rect.width
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            pixmap.save(image_path)

            slide = presentation.slides.add_slide(blank_layout)
            slide.shapes.add_picture(
                str(image_path),
                0,
                0,
                width=presentation.slide_width,
                height=presentation.slide_height,
            )

    presentation.save(OUTPUT)
    print(f"Created {OUTPUT} with {document.page_count} slides.")


if __name__ == "__main__":
    main()
