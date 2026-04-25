import { Box, Image } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import classes from "./project-cover-preview.module.css";

type ProjectCoverPreviewProps = {
  src: string | null;
  height?: number;
};

export function ProjectCoverPreview({
  src,
  height = 160,
}: ProjectCoverPreviewProps) {
  if (!src) {
    return (
      <Box
        h={height}
        className={classes.placeholder}
        bg="dark.6"
      >
        <IconPhoto size={40} stroke={1.25} opacity={0.35} />
      </Box>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      h={height}
      fit="cover"
      radius="md"
      fallbackSrc=""
    />
  );
}
