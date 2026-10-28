# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "torch==2.2.2", "transformers==4.51.3", "onnx==1.17.0",
#   "onnxruntime==1.21.0", "numpy==1.26.4",
# ]
# ///
"""Export pinned, local Dutch MiniLM weights for offline CPU/WASM inference."""

import json
import sys
from pathlib import Path

import numpy as np
import torch
from onnxruntime import InferenceSession, SessionOptions
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModel, AutoTokenizer


class TokenEncoder(torch.nn.Module):
    def __init__(self, network):
        super().__init__()
        self.network = network

    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.network(
            input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids
        ).last_hidden_state


def normalized_mean(hidden, mask):
    vectors = (hidden * mask[..., None]).sum(1) / mask.sum(1, keepdims=True)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def verify_export(network, source, destination):
    tokenizer = AutoTokenizer.from_pretrained(source, local_files_only=True)
    texts = [
        "De kat zit op de mat.",
        "Er zit een poes op het kleed.",
        "Het vliegtuig vliegt naar de luchthaven.",
    ]
    inputs = tokenizer(texts, padding=True, return_tensors="pt")
    with torch.no_grad():
        native = network(**inputs).last_hidden_state.numpy()
    options = SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = InferenceSession(
        destination, sess_options=options, providers=["CPUExecutionProvider"]
    )
    output = session.run(None, {key: value.numpy() for key, value in inputs.items()})[0]
    mask = inputs["attention_mask"].numpy()
    native, quantized = [normalized_mean(values, mask) for values in [native, output]]
    agreement = np.sum(native * quantized, axis=1)
    if agreement.min() < 0.99:
        raise ValueError("Dutch quantization differs too far from native embeddings.")
    report = {
        "nativeCosines": (native @ native.T).tolist(),
        "quantizedCosines": (quantized @ quantized.T).tolist(),
        "nativeQuantizedAgreement": agreement.tolist(),
    }
    target = Path(".cache/checks/dutch-export-parity.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + "\n")


def export(source, destination):
    network = AutoModel.from_pretrained(source, local_files_only=True).eval()
    encoder = TokenEncoder(network).eval()
    sample = torch.ones((2, 16), dtype=torch.long)
    raw = Path(source) / "model.onnx"
    names = ["input_ids", "attention_mask", "token_type_ids"]
    dynamic = {name: {0: "batch", 1: "sequence"} for name in [*names, "last_hidden_state"]}
    with torch.no_grad():
        torch.onnx.export(
            encoder,
            (sample, sample, torch.zeros_like(sample)),
            str(raw),
            input_names=names,
            output_names=["last_hidden_state"],
            dynamic_axes=dynamic,
            opset_version=17,
        )
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    quantize_dynamic(
        str(raw),
        destination,
        weight_type=QuantType.QInt8,
        per_channel=True,
        op_types_to_quantize=["MatMul"],
        extra_options={"MatMulConstBOnly": True},
    )
    verify_export(network, source, destination)


if __name__ == "__main__":
    export(*sys.argv[1:])
